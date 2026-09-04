<?php
defined('BASEPATH') or exit('No direct script access allowed');

/**
 * Name helper — shared handling of person names.
 *
 * Display names are composed as "First M. Last Ext" (see
 * User_model::compose_full_name), so anything reading a name back has to know
 * that the final token may be a generational suffix rather than a surname.
 */

if (!function_exists('name_extensions')) {
    /** Generational suffixes, lower-case and without punctuation. */
    function name_extensions()
    {
        return ['jr', 'sr', 'ii', 'iii', 'iv', 'v'];
    }
}

if (!function_exists('name_split')) {
    /**
     * Split a composed display name back into its parts. Used for accounts
     * created before the name columns existed, which only carry `full_name`.
     */
    function name_split($full_name)
    {
        $tokens = preg_split('/\s+/', trim((string) $full_name), -1, PREG_SPLIT_NO_EMPTY);
        $parts  = ['first_name' => '', 'middle_name' => '', 'last_name' => '', 'name_ext' => ''];

        if (!$tokens) {
            return $parts;
        }

        $tail = strtolower(rtrim(end($tokens), '.'));
        if (count($tokens) > 2 && in_array($tail, name_extensions(), true)) {
            $parts['name_ext'] = array_pop($tokens);
        }

        $parts['first_name'] = array_shift($tokens);

        if ($tokens) {
            $parts['last_name'] = array_pop($tokens);
        }

        if ($tokens) {
            $parts['middle_name'] = implode(' ', $tokens);
        }

        return $parts;
    }
}

if (!function_exists('name_initials')) {
    /**
     * Two-letter avatar initials: given name + surname. A trailing "Jr."/"III"
     * is skipped so it never stands in for the surname.
     */
    function name_initials($full_name)
    {
        $parts = name_split($full_name);
        return strtoupper(substr($parts['first_name'], 0, 1) . substr($parts['last_name'], 0, 1));
    }
}
