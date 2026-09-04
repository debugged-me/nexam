<?php
defined('BASEPATH') or exit('No direct script access allowed');

/**
 * Parse prospectus/curriculum documents (docx, xls, xlsx, pdf)
 * and extract subject codes with their prerequisites.
 */
class ProspectusParser
{
    private $ci;

    public function __construct()
    {
        $this->ci = &get_instance();
    }

    /**
     * Main entry: parse a file and return structured rows.
     *
     * @param string $filePath Absolute path to uploaded file.
     * @param string $ext      Extension (docx, xls, xlsx, pdf)
     * @return array Array of [code, title, prerequisites[]]
     */
    public function parse($filePath, $ext)
    {
        $ext = strtolower(ltrim($ext, '.'));

        switch ($ext) {
            case 'docx':
            case 'doc':
            case 'word':
                return $this->parseDocx($filePath);
            case 'xls':
            case 'xlsx':
            case 'excel':
                return $this->parseExcel($filePath);
            case 'pdf':
                return $this->parsePdf($filePath);
            default:
                throw new Exception('Unsupported file type: ' . $ext);
        }
    }

    /**
     * Parse DOCX using native ZipArchive + DOMDocument.
     */
    private function parseDocx($filePath)
    {
        if (!class_exists('ZipArchive')) {
            throw new Exception('ZipArchive extension is required for DOCX parsing.');
        }

        $zip = new ZipArchive;
        if ($zip->open($filePath) !== true) {
            throw new Exception('Could not open DOCX file.');
        }

        $xml = $zip->getFromName('word/document.xml');
        $zip->close();

        if ($xml === false) {
            throw new Exception('Could not read document.xml from DOCX.');
        }

        $dom = new DOMDocument;
        $dom->recover = true;
        @$dom->loadXML($xml);

        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');

        $rows = $xpath->query('//w:tr');
        $data = [];

        foreach ($rows as $row) {
            $cells = $xpath->query('w:tc', $row);
            $texts = [];
            foreach ($cells as $cell) {
                $tNodes = $xpath->query('.//w:t', $cell);
                $t = '';
                foreach ($tNodes as $n) {
                    $t .= $n->nodeValue;
                }
                $texts[] = $this->cleanText($t);
            }

            $parsed = $this->extractRow($texts);
            if (!empty($parsed)) {
                $data = array_merge($data, $parsed);
            }
        }

        return $data;
    }

    /**
     * Parse Excel using the project's existing PHPExcel library.
     */
    private function parseExcel($filePath)
    {
        $this->ci->load->library('PHPExcel');

        $reader = PHPExcel_IOFactory::createReaderForFile($filePath);
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($filePath);

        $data = [];
        foreach ($spreadsheet->getAllSheets() as $sheet) {
            $highestRow = $sheet->getHighestRow();
            $highestCol = $sheet->getHighestColumn();
            $highestColIndex = PHPExcel_Cell::columnIndexFromString($highestCol);

            for ($row = 1; $row <= $highestRow; $row++) {
                $texts = [];
                for ($col = 0; $col < $highestColIndex; $col++) {
                    $cellValue = $sheet->getCellByColumnAndRow($col, $row)->getValue();
                    $texts[] = $this->cleanText((string)$cellValue);
                }
                $parsed = $this->extractRow($texts);
                if (!empty($parsed)) {
                    $data = array_merge($data, $parsed);
                }
            }
        }

        return $data;
    }

    /**
     * Parse PDF using pdftotext (poppler-utils).
     * Falls back to a pure-PHP regex if pdftotext is unavailable.
     */
    private function parsePdf($filePath)
    {
        $pdftotext = @shell_exec('which pdftotext 2>/dev/null');
        $pdftotext = $pdftotext ? trim($pdftotext) : '';

        $text = '';
        if ($pdftotext && is_executable($pdftotext)) {
            $cmd = escapeshellarg($pdftotext) . ' -layout ' . escapeshellarg($filePath) . ' -';
            $text = @shell_exec($cmd);
        }

        if (empty($text)) {
            throw new Exception('pdftotext is required for PDF parsing. Install poppler-utils.');
        }

        $lines = explode("\n", $text);
        $data = [];
        foreach ($lines as $line) {
            // Try to split by multiple spaces (table-like layout)
            $parts = preg_split('/\s{2,}/', trim($line));
            $parsed = $this->extractRow($parts);
            if (!empty($parsed)) {
                $data = array_merge($data, $parsed);
            }
        }

        return $data;
    }

    /**
     * Clean raw text from a cell/field.
     */
    private function cleanText($text)
    {
        // Normalize whitespace
        $text = preg_replace('/\s+/', ' ', $text);
        return trim($text);
    }

    /**
     * Try to extract curriculum rows from an array of cell texts.
     *
     * Some prospectus tables place two semesters side-by-side in a single
     * physical row (10+ columns).  This method extracts every valid subject
     * entry it can find.
     *
     * @param array $cells
     * @return array List of ['code'=>string, 'title'=>string, 'prerequisites'=>[string]]
     */
    private function extractRow($cells)
    {
        if (empty($cells)) {
            return [];
        }

        // Trim trailing empties
        while (count($cells) > 0 && trim($cells[count($cells) - 1]) === '') {
            array_pop($cells);
        }

        if (count($cells) < 4) {
            return [];
        }

        // Skip obvious header / summary rows
        $first = strtoupper($cells[0]);
        $headerKeywords = ['COURSE', 'CODE', 'TITLE', 'CREDIT', 'UNITS', 'PRE-REQUISITE', 'PRE-REQ', 'PREREQUISITE', 'SUBJECT'];
        foreach ($headerKeywords as $kw) {
            if (strpos($first, $kw) !== false) {
                return [];
            }
        }
        if (strpos($first, 'TOTAL') !== false || strpos($first, 'SEMESTER') !== false) {
            return [];
        }

        $results = [];

        // Side-by-side layout: 10+ columns with two subject groups.
        // Common patterns:
        //   10 cols: [grade, code, title, units, prereq, grade, code, title, units, prereq]
        //   11 cols: [grade, code, title, units, prereq, empty, grade, code, title, units, prereq]
        if (count($cells) >= 9) {
            $slices = [
                [1, 2, 4],   // left side always starts at 1
            ];
            // Right side: try 11-cell variant first, then 10-cell
            if (count($cells) >= 11) {
                $slices[] = [7, 8, 10];
            } else {
                $slices[] = [6, 7, 9];
            }
            foreach ($slices as $slice) {
                list($codeIdx, $titleIdx, $preIdx) = $slice;
                if ($codeIdx < count($cells) && $this->normalizeCode($cells[$codeIdx])) {
                    $row = $this->buildExtractedRow($cells, $codeIdx, $titleIdx, $preIdx);
                    if ($row) {
                        $results[] = $row;
                    }
                }
            }
        }

        // Standard single-row layout
        if (empty($results)) {
            $startIdx = 0;
            // Some tables have an empty GRADE column at the start (e.g. 5-cell rows)
            if (!$this->normalizeCode($cells[0]) && count($cells) >= 5 && $this->normalizeCode($cells[1])) {
                $startIdx = 1;
            }
            $code = $this->normalizeCode($cells[$startIdx]);
            if ($code) {
                $preIdx = count($cells) >= 6 ? 5 : (count($cells) - 1);
                // If we shifted by 1, also shift the prereq index
                if ($startIdx === 1) {
                    $preIdx = min($preIdx + 1, count($cells) - 1);
                }
                $row = $this->buildExtractedRow($cells, $startIdx, $startIdx + 1, $preIdx);
                if ($row) {
                    $results[] = $row;
                }
            }
        }

        return $results;
    }

    /**
     * Build a single extracted row from known column indices.
     *
     * @param array $cells
     * @param int   $codeIdx
     * @param int   $titleIdx
     * @param int   $preIdx
     * @return array|null
     */
    private function buildExtractedRow($cells, $codeIdx, $titleIdx, $preIdx)
    {
        $code = $this->normalizeCode($cells[$codeIdx] ?? '');
        if (!$code) {
            return null;
        }

        $title = trim($cells[$titleIdx] ?? '');
        if (preg_match('/^\d+(\.\d+)?$/', $title)) {
            $title = '';
        }

        $prereqStr = trim($cells[$preIdx] ?? '');
        $prerequisites = $this->parsePrerequisites($prereqStr);

        $prerequisites = array_values(array_filter($prerequisites, function ($p) use ($code) {
            return strtoupper($p) !== strtoupper($code);
        }));

        return [
            'code' => $code,
            'title' => $title,
            'prerequisites' => $prerequisites,
        ];
    }

    /**
     * Normalize a raw course code string.
     *
     * Handles common variations:
     *   - "SAMPLE1"      → "SAMPLE 1"  (inserts space between letters and digits)
     *   - "SAMPLE-1"     → "SAMPLE 1"  (hyphen → space)
     *   - "SAMPLE  1"    → "SAMPLE 1"  (collapses multiple spaces)
     */
    private function normalizeCode($raw)
    {
        $raw = trim($raw);
        // Remove any trailing text that might have leaked from merged cells
        $raw = preg_replace('/\s{3,}/', ' ', $raw);

        // Must contain letters and numbers
        if (!preg_match('/[A-Za-z]/', $raw) || !preg_match('/\d/', $raw)) {
            return null;
        }

        // Replace hyphens with spaces first
        $code = str_replace('-', ' ', $raw);

        // Insert space between letters and digits when joined directly
        // e.g. "SAMPLE1" → "SAMPLE 1", "CS101" → "CS 101", "GE101A" → "GE 101 A"
        $code = preg_replace('/([A-Za-z])(\d)/', '$1 $2', $code);
        $code = preg_replace('/(\d)([A-Za-z])/', '$1 $2', $code);

        // Clean up: uppercase, single spaces
        $code = strtoupper(preg_replace('/\s+/', ' ', trim($code)));

        // Basic validation
        if (strlen($code) < 2 || strlen($code) > 25) {
            return null;
        }

        return $code;
    }

    /**
     * Parse the prerequisite cell content into an array of codes.
     */
    private function parsePrerequisites($text)
    {
        $text = trim($text);
        if ($text === '' || strtoupper($text) === 'NONE' || strtoupper($text) === 'N/A') {
            return [];
        }

        // Split by comma, slash, or "and"
        $parts = preg_split('/[,\/]|\band\b/i', $text);
        $codes = [];
        foreach ($parts as $part) {
            $part = trim($part);
            $part = $this->normalizeCode($part);
            if ($part) {
                $codes[] = $part;
            }
        }

        return array_unique($codes);
    }
}
