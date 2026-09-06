<?php
defined('BASEPATH') or exit('No direct script access allowed');

if (!function_exists('nexam_asset')) {
    /**
     * Return a public asset URL with a file modification version.
     *
     * Static assets are cached for 30 days by Apache. The version query makes
     * each deployed revision immediately visible without asking users to hard
     * refresh, while still allowing immutable browser caching between edits.
     */
    function nexam_asset($path)
    {
        $path = ltrim((string) $path, '/');
        $url = base_url($path);
        $asset_root = realpath(FCPATH . 'assets');
        $file = realpath(FCPATH . $path);

        if ($asset_root !== false && $file !== false
            && strpos($file, $asset_root . DIRECTORY_SEPARATOR) === 0) {
            return $url . '?v=' . rawurlencode((string) filemtime($file));
        }

        return $url;
    }
}
