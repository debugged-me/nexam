<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Paymongo_client
{
    private $secretKey = '';
    private $apiBase = 'https://api.paymongo.com/v1';

    public function __construct($params = [])
    {
        if (is_array($params)) {
            $this->configure($params);
        }
    }

    public function configure(array $settings = [])
    {
        if (!empty($settings['secret_key'])) {
            $this->secretKey = trim((string)$settings['secret_key']);
        }

        if (!empty($settings['api_base'])) {
            $this->apiBase = rtrim((string)$settings['api_base'], '/');
        }
    }

    public function is_configured(): bool
    {
        return $this->secretKey !== '';
    }

    public function create_payment_intent(array $attributes)
    {
        return $this->request('POST', '/payment_intents', [
            'data' => [
                'attributes' => $attributes,
            ],
        ]);
    }

    public function create_payment_method(array $attributes)
    {
        return $this->request('POST', '/payment_methods', [
            'data' => [
                'attributes' => $attributes,
            ],
        ]);
    }

    public function attach_payment_intent($paymentIntentId, $paymentMethodId, $returnUrl = '')
    {
        $payload = [
            'data' => [
                'attributes' => [
                    'payment_method' => (string)$paymentMethodId,
                ],
            ],
        ];

        $returnUrl = trim((string)$returnUrl);
        if ($returnUrl !== '') {
            $payload['data']['attributes']['return_url'] = $returnUrl;
        }

        return $this->request('POST', '/payment_intents/' . rawurlencode((string)$paymentIntentId) . '/attach', $payload);
    }

    public function retrieve_payment_intent($paymentIntentId)
    {
        return $this->request('GET', '/payment_intents/' . rawurlencode((string)$paymentIntentId));
    }

    public function request($method, $path, $payload = null)
    {
        if (!$this->is_configured()) {
            return [
                'ok' => false,
                'status_code' => 0,
                'body' => null,
                'raw' => '',
                'error' => 'PayMongo secret key is not configured.',
            ];
        }

        $ch = curl_init($this->apiBase . '/' . ltrim((string)$path, '/'));

        $headers = [
            'Accept: application/json',
            'Content-Type: application/json',
            'Authorization: Basic ' . base64_encode($this->secretKey . ':'),
        ];

        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => strtoupper((string)$method),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 45,
            CURLOPT_CONNECTTIMEOUT => 15,
        ];

        if ($payload !== null) {
            $options[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_UNESCAPED_SLASHES);
        }

        curl_setopt_array($ch, $options);

        $raw = curl_exec($ch);
        $errno = curl_errno($ch);
        $curlError = $errno ? curl_error($ch) : '';
        $statusCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if (!is_string($raw)) {
            $raw = '';
        }

        $decoded = $raw !== '' ? json_decode($raw, true) : null;
        $ok = ($errno === 0 && $statusCode >= 200 && $statusCode < 300);

        return [
            'ok' => $ok,
            'status_code' => $statusCode,
            'body' => is_array($decoded) ? $decoded : null,
            'raw' => $raw,
            'error' => $ok ? '' : $this->extract_error_message($decoded, $curlError, $statusCode),
        ];
    }

    private function extract_error_message($decoded, $curlError, $statusCode)
    {
        if ($curlError !== '') {
            return $curlError;
        }

        if (is_array($decoded)) {
            if (!empty($decoded['errors'][0]['detail'])) {
                return (string)$decoded['errors'][0]['detail'];
            }

            if (!empty($decoded['errors'][0]['code'])) {
                return (string)$decoded['errors'][0]['code'];
            }

            if (!empty($decoded['error'])) {
                return (string)$decoded['error'];
            }
        }

        if ($statusCode > 0) {
            return 'PayMongo request failed with HTTP ' . $statusCode . '.';
        }

        return 'PayMongo request failed.';
    }
}
