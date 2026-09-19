<?php
defined('BASEPATH') or exit('No direct script access allowed');

/**
 * Nexam_api — PHP client for the Node.js API service.
 *
 * Handles JWT-based authentication and HTTP communication between the
 * CodeIgniter web app and the Node API (AI/RAG/material routes).
 *
 * The PHP app authenticates to the Node API by issuing a short-lived JWT
 * using the same JWT_SECRET as the Node service. This avoids storing a
 * separate service token — both sides share the same secret.
 */
class Nexam_api
{
    /** Base URL of the Node API — override with NEXAM_API_BASE_URL env var. */
    private $base_url;

    /** JWT secret (shared with Node .env JWT_SECRET). */
    private $jwt_secret;

    /** Cached JWT token. */
    private $token = null;

    public function __construct()
    {
        $this->jwt_secret = $this->_resolve_jwt_secret();
        $base = getenv('NEXAM_API_BASE_URL');
        $this->base_url = $base ? rtrim($base, '/') : 'http://localhost:3000/api';
    }

    /**
     * Resolve the JWT secret the same way the Node API does:
     *   1. JWT_SECRET environment variable
     *   2. JWT_SECRET entry in api/.env (the file dotenv loads)
     *   3. Hard fallback — must match env.js's default
     */
    private function _resolve_jwt_secret()
    {
        $env = getenv('JWT_SECRET');
        if ($env) return $env;

        $envFile = FCPATH . 'api/.env';
        if (is_file($envFile) && is_readable($envFile)) {
            foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
                list($k, $v) = explode('=', $line, 2);
                if (trim($k) === 'JWT_SECRET') {
                    $v = trim($v);
                    // Strip surrounding quotes dotenv-style
                    if (strlen($v) > 1 && ($v[0] === '"' || $v[0] === "'") && $v[strlen($v) - 1] === $v[0]) {
                        $v = substr($v, 1, -1);
                    }
                    if ($v !== '') return $v;
                }
            }
        }

        return 'dev-insecure-secret-change-me';
    }

    /**
     * Generate a service JWT for the Node API.
     * Uses the current session user's id/role if available.
     */
    private function get_token()
    {
        if ($this->token) return $this->token;

        $CI =& get_instance();
        $user_id = $CI->session->userdata('user_id');
        $email = $CI->session->userdata('email');
        $role = $CI->session->userdata('role');

        // Build a minimal JWT (HS256)
        $header = $this->_base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $now = time();
        $payload = $this->_base64url(json_encode([
            'id' => $user_id,
            'email' => $email,
            'role' => $role,
            'iat' => $now,
            'exp' => $now + 3600, // 1 hour
        ]));
        $sig = $this->_base64url(hash_hmac('sha256', "$header.$payload", $this->jwt_secret, true));
        $this->token = "$header.$payload.$sig";
        return $this->token;
    }

    /**
     * Make a GET request to the Node API.
     *
     * @param string $path  Path relative to /api (e.g. 'materials')
     * @param array  $query Query string params
     * @return array ['status' => int, 'body' => array|null]
     */
    public function get($path, $query = [])
    {
        $url = $this->base_url . '/' . ltrim($path, '/');
        if ($query) $url .= '?' . http_build_query($query);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->get_token(),
                'Accept: application/json',
            ],
            CURLOPT_TIMEOUT => 30,
        ]);

        $response = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) return ['status' => 0, 'body' => null, 'error' => $error];
        return ['status' => $status, 'body' => json_decode($response, true)];
    }

    /**
     * Make a POST request to the Node API.
     *
     * @param string $path  Path relative to /api
     * @param array  $data  POST body (JSON-encoded)
     * @return array ['status' => int, 'body' => array|null]
     */
    public function post($path, $data = [])
    {
        $url = $this->base_url . '/' . ltrim($path, '/');

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->get_token(),
                'Content-Type: application/json',
                'Accept: application/json',
            ],
            CURLOPT_TIMEOUT => 30,
        ]);

        $response = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) return ['status' => 0, 'body' => null, 'error' => $error];
        return ['status' => $status, 'body' => json_decode($response, true)];
    }

    /**
     * Upload a file to the Node API via multipart form.
     *
     * @param string $path     API path
     * @param string $filePath Local file path
     * @param string $fileField Field name for the file
     * @param array  $fields   Additional form fields
     * @return array
     */
    public function upload($path, $filePath, $fileField = 'file', $fields = [])
    {
        $url = $this->base_url . '/' . ltrim($path, '/');

        // Build multipart body manually (CURLFile requires PHP 5.5+)
        $postFields = $fields;
        $postFields[$fileField] = new CURLFile($filePath);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $postFields,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->get_token(),
                'Accept: application/json',
            ],
            CURLOPT_TIMEOUT => 60,
        ]);

        $response = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) return ['status' => 0, 'body' => null, 'error' => $error];
        return ['status' => $status, 'body' => json_decode($response, true)];
    }

    /**
     * Make a DELETE request to the Node API.
     */
    public function delete($path)
    {
        $url = $this->base_url . '/' . ltrim($path, '/');

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => 'DELETE',
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->get_token(),
                'Accept: application/json',
            ],
            CURLOPT_TIMEOUT => 30,
        ]);

        $response = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) return ['status' => 0, 'body' => null, 'error' => $error];
        return ['status' => $status, 'body' => json_decode($response, true)];
    }

    /**
     * Public accessors for callers that need the raw token/base URL
     * (e.g. streaming a download through PHP with its own curl handle).
     */
    public function token()
    {
        return $this->get_token();
    }

    public function base_url()
    {
        return $this->base_url;
    }

    private function _base64url($data)
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
