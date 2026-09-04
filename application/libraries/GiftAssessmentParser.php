<?php
defined('BASEPATH') or exit('No direct script access allowed');

class GiftAssessmentParser
{
    public function parse(string $input, ?string $sourceName = null): array
    {
        $input = trim(str_replace("\r\n", "\n", str_replace("\r", "\n", $this->stripBom($input))));
        if ($input === '') {
            return ['questions' => [], 'warnings' => []];
        }

        if ($this->looksLikeXml($input, $sourceName)) {
            return $this->parseXml($input);
        }

        return $this->parseGift($input);
    }

    private function parseGift(string $input): array
    {
        $blocks = $this->splitGiftBlocks($input);
        $questions = [];
        $warnings = [];

        foreach ($blocks as $idx => $block) {
            $block = trim($block);
            if ($block === '' || preg_match('/^\$CATEGORY:/i', $block)) {
                continue;
            }

            if (preg_match('/^\s*\/\//', $block)) {
                continue;
            }

            $question = $this->parseBlock($block, $idx + 1, $warnings);
            if ($question !== null) {
                $questions[] = $question;
            }
        }

        return ['questions' => $questions, 'warnings' => $warnings];
    }

    private function splitGiftBlocks(string $input): array
    {
        $lines = preg_split("/\n/u", $input) ?: [];
        $blocks = [];
        $buffer = [];
        $braceDepth = 0;
        $hasAnswerBlock = false;

        foreach ($lines as $line) {
            $trimmed = trim($line);

            if ($hasAnswerBlock && $braceDepth === 0 && $this->looksLikeGiftBlockBoundary($trimmed) && !empty($buffer)) {
                $block = trim(implode("\n", $buffer));
                if ($block !== '') {
                    $blocks[] = $block;
                }
                $buffer = [];
                $hasAnswerBlock = false;
            }

            $buffer[] = $line;

            $braceStats = $this->countUnescapedBraces($line);
            if ($braceStats['open'] > 0) {
                $hasAnswerBlock = true;
            }
            $braceDepth += $braceStats['open'] - $braceStats['close'];
            if ($braceDepth < 0) {
                $braceDepth = 0;
            }

            if ($hasAnswerBlock && $braceDepth === 0 && $trimmed === '') {
                $block = trim(implode("\n", $buffer));
                if ($block !== '') {
                    $blocks[] = $block;
                }
                $buffer = [];
                $hasAnswerBlock = false;
            }
        }

        $tail = trim(implode("\n", $buffer));
        if ($tail !== '') {
            $blocks[] = $tail;
        }

        return $blocks;
    }

    private function looksLikeGiftBlockBoundary(string $line): bool
    {
        if ($line === '') {
            return false;
        }

        return preg_match('/^(::.*::|\$CATEGORY:|\/\/)/i', $line) === 1;
    }

    private function countUnescapedBraces(string $line): array
    {
        $open = 0;
        $close = 0;
        $escaped = false;
        $length = strlen($line);

        for ($i = 0; $i < $length; $i++) {
            $char = $line[$i];
            if ($escaped) {
                $escaped = false;
                continue;
            }
            if ($char === '\\') {
                $escaped = true;
                continue;
            }
            if ($char === '{') {
                $open++;
            } elseif ($char === '}') {
                $close++;
            }
        }

        return ['open' => $open, 'close' => $close];
    }

    private function parseBlock(string $block, int $position, array &$warnings): ?array
    {
        $title = '';
        if (preg_match('/^::(.*?)::(.*)$/s', $block, $m)) {
            $title = trim($m[1]);
            $block = trim($m[2]);
        }

        [$prompt, $answerBlock] = $this->splitQuestionAndAnswer($block);
        $prompt = trim($this->unescape($prompt));

        if ($prompt === '') {
            $warnings[] = "Skipped GIFT item {$position}: empty question prompt.";
            return null;
        }

        if ($answerBlock === null) {
            $warnings[] = "Skipped GIFT item {$position}: unsupported description-only block.";
            return null;
        }

        $answerBlock = trim($answerBlock);

        if ($answerBlock === '') {
            return [
                'gift_name' => $title,
                'question_type' => 'essay',
                'prompt' => $prompt,
                'points' => 1,
                'choices' => [],
                'answer_key' => [],
                'metadata' => ['manual_grading' => true],
            ];
        }

        if (preg_match('/^(T|TRUE|F|FALSE)(#.*)?$/i', $answerBlock, $m)) {
            $value = strtoupper($m[1]);
            return [
                'gift_name' => $title,
                'question_type' => 'true_false',
                'prompt' => $prompt,
                'points' => 1,
                'choices' => [
                    ['id' => 'true', 'text' => 'True'],
                    ['id' => 'false', 'text' => 'False'],
                ],
                'answer_key' => [$value === 'T' || $value === 'TRUE' ? 'true' : 'false'],
                'metadata' => [],
            ];
        }

        $entries = $this->parseAnswerEntries($answerBlock);
        if (empty($entries)) {
            $warnings[] = "Skipped GIFT item {$position}: answer block could not be parsed.";
            return null;
        }

        $allMatching = true;
        foreach ($entries as $entry) {
            if ($entry['prefix'] !== '=' || strpos($entry['text'], '->') === false) {
                $allMatching = false;
                break;
            }
        }

        if ($allMatching) {
            $pairs = [];
            $rightOptions = [];
            foreach ($entries as $entry) {
                [$left, $right] = array_map('trim', explode('->', $entry['text'], 2));
                $left = $this->unescape($left);
                $right = $this->unescape($right);
                if ($left === '' || $right === '') {
                    continue;
                }
                $pairs[$left] = $right;
                $rightOptions[] = $right;
            }

            if (empty($pairs)) {
                $warnings[] = "Skipped GIFT item {$position}: matching question has no valid pairs.";
                return null;
            }

            return [
                'gift_name' => $title,
                'question_type' => 'matching',
                'prompt' => $prompt,
                'points' => 1,
                'choices' => array_values(array_unique($rightOptions)),
                'answer_key' => $pairs,
                'metadata' => ['pairs' => count($pairs)],
            ];
        }

        $allShortAnswer = true;
        foreach ($entries as $entry) {
            if ($entry['prefix'] !== '=') {
                $allShortAnswer = false;
                break;
            }
        }

        if ($allShortAnswer) {
            $answers = [];
            foreach ($entries as $entry) {
                $answer = trim($this->unescape($entry['text']));
                if ($answer !== '') {
                    $answers[] = $answer;
                }
            }

            if (empty($answers)) {
                $warnings[] = "Skipped GIFT item {$position}: short-answer question has no accepted answers.";
                return null;
            }

            return [
                'gift_name' => $title,
                'question_type' => 'short_answer',
                'prompt' => $prompt,
                'points' => 1,
                'choices' => [],
                'answer_key' => array_values(array_unique($answers)),
                'metadata' => [],
            ];
        }

        $choices = [];
        $answerKey = [];
        $correctCount = 0;

        foreach ($entries as $i => $entry) {
            $choiceId = 'choice_' . ($i + 1);
            $choices[] = [
                'id' => $choiceId,
                'text' => $this->unescape($entry['text']),
            ];

            $isCorrect = $entry['prefix'] === '=' || ($entry['weight'] !== null && $entry['weight'] > 0);
            if ($isCorrect) {
                $answerKey[] = $choiceId;
                $correctCount++;
            }
        }

        if (empty($choices) || $correctCount === 0) {
            $warnings[] = "Skipped GIFT item {$position}: multiple-choice question has no correct answer.";
            return null;
        }

        return [
            'gift_name' => $title,
            'question_type' => $correctCount > 1 ? 'multiple_choice' : 'single_choice',
            'prompt' => $prompt,
            'points' => 1,
            'choices' => $choices,
            'answer_key' => $answerKey,
            'metadata' => ['correct_count' => $correctCount],
        ];
    }

    private function looksLikeXml(string $input, ?string $sourceName = null): bool
    {
        $sourceName = strtolower(trim((string)$sourceName));
        if ($sourceName !== '' && substr($sourceName, -4) === '.xml') {
            return true;
        }

        return preg_match('/^\s*(<\?xml\b|<quiz\b|<questions?\b)/i', $input) === 1;
    }

    private function parseXml(string $input): array
    {
        $previous = libxml_use_internal_errors(true);
        $xml = simplexml_load_string($input, 'SimpleXMLElement', LIBXML_NOCDATA);
        $warnings = [];

        if (!$xml) {
            foreach (libxml_get_errors() as $error) {
                $warnings[] = 'XML import parse error: ' . trim($error->message);
            }
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
            return ['questions' => [], 'warnings' => !empty($warnings) ? $warnings : ['XML import could not be parsed.']];
        }

        $questions = [];
        $position = 0;

        foreach ($xml->question as $questionNode) {
            $position++;
            $type = strtolower(trim((string)$questionNode['type']));
            if ($type === '' || in_array($type, ['category', 'description'], true)) {
                continue;
            }

            $parsed = $this->parseXmlQuestion($questionNode, $position, $warnings);
            if ($parsed !== null) {
                $questions[] = $parsed;
            }
        }

        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        return ['questions' => $questions, 'warnings' => $warnings];
    }

    private function parseXmlQuestion(SimpleXMLElement $questionNode, int $position, array &$warnings): ?array
    {
        $type = strtolower(trim((string)$questionNode['type']));
        $title = $this->xmlText($questionNode, 'name/text');
        $prompt = $this->xmlText($questionNode, 'questiontext/text');
        $points = $this->xmlPoints($questionNode, 1.0);

        if ($prompt === '') {
            if ($title !== '') {
                $prompt = $title;
                $warnings[] = "XML item {$position}: empty prompt replaced with question title.";
            } else {
                $prompt = 'Imported question #' . $position;
                $warnings[] = "XML item {$position}: empty prompt replaced with generated placeholder.";
            }
        }

        if ($type === 'multichoice') {
            $choices = [];
            $fractions = [];
            $answerKey = [];
            $correctCount = 0;
            $single = strtolower(trim((string)$questionNode->single)) !== 'false';

            $choiceIndex = 0;
            foreach ($questionNode->answer as $answerNode) {
                $text = $this->xmlText($answerNode, 'text');
                $text = $this->preserveLiteralTagToken($text, $this->xmlRawText($answerNode, 'text'));
                if ($text === '') {
                    continue;
                }

                $choiceIndex++;
                $choiceId = 'choice_' . $choiceIndex;
                $choices[] = ['id' => $choiceId, 'text' => $text];
                $fraction = is_numeric((string)$answerNode['fraction']) ? (float)$answerNode['fraction'] : 0.0;
                $fractions[$choiceId] = $fraction;
                if ($fraction > 0) {
                    $answerKey[] = $choiceId;
                    $correctCount++;
                }
            }

            if (count($choices) === 0) {
                return $this->buildEssayFallback(
                    $title,
                    $prompt,
                    $points,
                    "multiple-choice question has no valid choices.",
                    $position,
                    $warnings
                );
            }

            if (count($choices) === 1) {
                $warnings[] = "XML item {$position}: multiple-choice question had one valid choice only; imported as short-answer fallback.";
                return [
                    'gift_name' => $title,
                    'question_type' => 'short_answer',
                    'prompt' => $prompt,
                    'points' => $points,
                    'choices' => [],
                    'answer_key' => [$choices[0]['text']],
                    'metadata' => ['import_fallback' => 'multichoice_to_short_answer'],
                ];
            }

            if ($correctCount === 0) {
                arsort($fractions, SORT_NUMERIC);
                $fallbackId = key($fractions);
                if ($fallbackId !== null) {
                    $answerKey = [(string)$fallbackId];
                    $correctCount = 1;
                    $warnings[] = "XML item {$position}: multiple-choice question had no positive-fraction answer; a fallback correct option was assigned.";
                }
            }

            return [
                'gift_name' => $title,
                'question_type' => (!$single || $correctCount > 1) ? 'multiple_choice' : 'single_choice',
                'prompt' => $prompt,
                'points' => $points,
                'choices' => $choices,
                'answer_key' => $answerKey,
                'metadata' => ['correct_count' => $correctCount],
            ];
        }

        if ($type === 'truefalse') {
            $correct = null;
            foreach ($questionNode->answer as $answerNode) {
                $text = strtolower($this->xmlText($answerNode, 'text'));
                if ((float)$answerNode['fraction'] > 0 && in_array($text, ['true', 'false'], true)) {
                    $correct = $text;
                    break;
                }
            }

            if ($correct === null) {
                return $this->buildEssayFallback(
                    $title,
                    $prompt,
                    $points,
                    "true/false question has no correct answer.",
                    $position,
                    $warnings
                );
            }

            return [
                'gift_name' => $title,
                'question_type' => 'true_false',
                'prompt' => $prompt,
                'points' => $points,
                'choices' => [
                    ['id' => 'true', 'text' => 'True'],
                    ['id' => 'false', 'text' => 'False'],
                ],
                'answer_key' => [$correct],
                'metadata' => [],
            ];
        }

        if ($type === 'shortanswer') {
            $answers = [];
            $fallbackAnswers = [];
            foreach ($questionNode->answer as $answerNode) {
                $text = $this->xmlText($answerNode, 'text');
                $text = $this->preserveLiteralTagToken($text, $this->xmlRawText($answerNode, 'text'));
                if ($text === '') {
                    continue;
                }

                $fallbackAnswers[] = $text;
                if ((float)$answerNode['fraction'] > 0) {
                    $answers[] = $text;
                }
            }

            if (empty($answers)) {
                if (!empty($fallbackAnswers)) {
                    $answers = $fallbackAnswers;
                    $warnings[] = "XML item {$position}: short-answer question had no positive-fraction answers; imported non-empty answers as accepted.";
                } else {
                    return $this->buildEssayFallback(
                        $title,
                        $prompt,
                        $points,
                        "short-answer question has no accepted answers.",
                        $position,
                        $warnings
                    );
                }
            }

            return [
                'gift_name' => $title,
                'question_type' => 'short_answer',
                'prompt' => $prompt,
                'points' => $points,
                'choices' => [],
                'answer_key' => array_values(array_unique($answers)),
                'metadata' => [],
            ];
        }

        if ($type === 'matching') {
            $pairs = [];
            $choices = [];

            foreach ($questionNode->subquestion as $subquestion) {
                $left = $this->xmlText($subquestion, 'text');
                $right = $this->xmlText($subquestion, 'answer/text');
                if ($left === '' || $right === '') {
                    continue;
                }
                $pairs[$left] = $right;
                $choices[] = $right;
            }

            if (count($pairs) < 2) {
                if (count($pairs) === 1) {
                    $singleLeft = (string)array_key_first($pairs);
                    $singleRight = (string)($pairs[$singleLeft] ?? '');
                    $warnings[] = "XML item {$position}: matching question had one valid pair only; imported as short-answer fallback.";
                    return [
                        'gift_name' => $title,
                        'question_type' => 'short_answer',
                        'prompt' => $prompt . ' (' . $singleLeft . ')',
                        'points' => $points,
                        'choices' => [],
                        'answer_key' => [$singleRight],
                        'metadata' => ['import_fallback' => 'matching_to_short_answer'],
                    ];
                }

                return $this->buildEssayFallback(
                    $title,
                    $prompt,
                    $points,
                    "matching question has fewer than two valid pairs.",
                    $position,
                    $warnings
                );
            }

            return [
                'gift_name' => $title,
                'question_type' => 'matching',
                'prompt' => $prompt,
                'points' => $points,
                'choices' => array_values(array_unique($choices)),
                'answer_key' => $pairs,
                'metadata' => ['pairs' => count($pairs)],
            ];
        }

        if ($type === 'essay') {
            return [
                'gift_name' => $title,
                'question_type' => 'essay',
                'prompt' => $prompt,
                'points' => $points,
                'choices' => [],
                'answer_key' => [],
                'metadata' => ['manual_grading' => true],
            ];
        }

        return $this->buildEssayFallback(
            $title,
            $prompt,
            $points,
            "unsupported question type {$type}.",
            $position,
            $warnings
        );
    }

    private function buildEssayFallback(
        string $title,
        string $prompt,
        float $points,
        string $reason,
        int $position,
        array &$warnings
    ): array {
        $warnings[] = "XML item {$position}: {$reason} Imported as essay fallback.";

        return [
            'gift_name' => $title,
            'question_type' => 'essay',
            'prompt' => $prompt,
            'points' => $points,
            'choices' => [],
            'answer_key' => [],
            'metadata' => [
                'manual_grading' => true,
                'import_fallback' => 'xml_to_essay',
                'import_reason' => $reason,
            ],
        ];
    }

    private function xmlText(SimpleXMLElement $node, string $path): string
    {
        $current = $node;
        foreach (explode('/', $path) as $segment) {
            if (!isset($current->{$segment})) {
                return '';
            }
            $current = $current->{$segment};
        }

        return $this->cleanXmlText((string)$current);
    }

    private function xmlRawText(SimpleXMLElement $node, string $path): string
    {
        $current = $node;
        foreach (explode('/', $path) as $segment) {
            if (!isset($current->{$segment})) {
                return '';
            }
            $current = $current->{$segment};
        }

        if (!function_exists('dom_import_simplexml')) {
            return trim((string)$current);
        }

        $domNode = dom_import_simplexml($current);
        if (!$domNode) {
            return trim((string)$current);
        }

        $raw = '';
        foreach ($domNode->childNodes as $child) {
            $raw .= $domNode->ownerDocument->saveXML($child);
        }

        if (trim($raw) === '') {
            $raw = (string)$current;
        }

        return trim($raw);
    }

    private function preserveLiteralTagToken(string $cleanText, string $rawText): string
    {
        $cleanText = trim($cleanText);
        $rawText = trim($rawText);

        if ($rawText === '') {
            return $cleanText;
        }

        $decodedRaw = html_entity_decode($rawText, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $decodedRaw = trim((string)$decodedRaw);
        $compactRaw = preg_replace('/\s+/', '', $decodedRaw) ?? $decodedRaw;

        if (preg_match('/^<([a-z][a-z0-9:_-]*)>$/i', $compactRaw, $m)) {
            return '<' . strtolower((string)$m[1]) . '>';
        }

        if (preg_match('/^<\s*([a-z][a-z0-9:_-]*)\b[^>]*>\s*([^<]*)\s*<\/\s*\1\s*>$/is', $decodedRaw, $m)) {
            $tag = strtolower(trim((string)$m[1]));
            $inner = strtolower(trim((string)($m[2] ?? '')));
            if ($inner === '' || $inner === $tag || strtolower($cleanText) === $tag) {
                return '<' . $tag . '>';
            }
        }

        return $cleanText;
    }

    private function xmlPoints(SimpleXMLElement $questionNode, float $default): float
    {
        $points = trim((string)$questionNode->defaultgrade);
        if ($points !== '' && is_numeric($points) && (float)$points > 0) {
            return round((float)$points, 2);
        }

        return $default;
    }

    private function cleanXmlText(string $text): string
    {
        $text = preg_replace('/<br\s*\/?>/i', "\n", $text);
        $text = strip_tags($text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace("/\r\n?/", "\n", $text);
        return trim($text ?? '');
    }

    private function splitQuestionAndAnswer(string $block): array
    {
        $len = strlen($block);
        $start = null;
        $end = null;
        $escaped = false;

        for ($i = 0; $i < $len; $i++) {
            $char = $block[$i];
            if ($escaped) {
                $escaped = false;
                continue;
            }
            if ($char === '\\') {
                $escaped = true;
                continue;
            }
            if ($char === '{' && $start === null) {
                $start = $i;
            }
            if ($char === '}') {
                $end = $i;
            }
        }

        if ($start === null || $end === null || $end <= $start) {
            return [$block, null];
        }

        return [
            trim(substr($block, 0, $start)),
            trim(substr($block, $start + 1, $end - $start - 1)),
        ];
    }

    private function parseAnswerEntries(string $answerBlock): array
    {
        $entries = [];
        $mode = null;
        $buffer = '';
        $escaped = false;
        $len = strlen($answerBlock);

        for ($i = 0; $i < $len; $i++) {
            $char = $answerBlock[$i];

            if ($escaped) {
                $buffer .= $char;
                $escaped = false;
                continue;
            }

            if ($char === '\\') {
                $buffer .= $char;
                $escaped = true;
                continue;
            }

            if (($char === '=' || $char === '~')) {
                if ($mode !== null) {
                    $entries[] = $this->buildEntry($mode, $buffer);
                }
                $mode = $char;
                $buffer = '';
                continue;
            }

            $buffer .= $char;
        }

        if ($mode !== null) {
            $entries[] = $this->buildEntry($mode, $buffer);
        }

        return array_values(array_filter($entries, static function ($entry) {
            return $entry['text'] !== '';
        }));
    }

    private function buildEntry(string $prefix, string $buffer): array
    {
        $buffer = trim($buffer);
        $weight = null;

        if (preg_match('/^%(-?\d+(?:\.\d+)?)%(.*)$/s', $buffer, $m)) {
            $weight = (float)$m[1];
            $buffer = trim($m[2]);
        }

        $buffer = trim($this->stripFeedback($buffer));

        return [
            'prefix' => $prefix,
            'weight' => $weight,
            'text' => $buffer,
        ];
    }

    private function stripFeedback(string $text): string
    {
        $out = '';
        $escaped = false;
        $len = strlen($text);

        for ($i = 0; $i < $len; $i++) {
            $char = $text[$i];
            if ($escaped) {
                $out .= $char;
                $escaped = false;
                continue;
            }
            if ($char === '\\') {
                $out .= $char;
                $escaped = true;
                continue;
            }
            if ($char === '#') {
                break;
            }
            $out .= $char;
        }

        return $out;
    }

    private function unescape(string $text): string
    {
        return strtr($text, [
            '\~' => '~',
            '\=' => '=',
            '\#' => '#',
            '\{' => '{',
            '\}' => '}',
            '\:' => ':',
            '\n' => "\n",
        ]);
    }

    private function stripBom(string $text): string
    {
        return preg_replace('/^\xEF\xBB\xBF/', '', $text) ?? $text;
    }
}
