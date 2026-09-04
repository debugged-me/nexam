<?php defined('BASEPATH') or exit('No direct script access allowed');

class Sim800c
{
    /** @var CI_Controller */
    protected $CI;

    // ✅ Update this to your actual port
    protected $port = '/dev/cu.usbserial-110';
    protected $baud = 115200;

    // Timeouts
    protected $readTimeoutSec = 4;

    public function __construct($params = [])
    {
        $this->CI = get_instance();
        if (!empty($params['port'])) $this->port = $params['port'];
        if (!empty($params['baud'])) $this->baud = (int)$params['baud'];
    }

    public function setPort($port)
    {
        $this->port = $port;
    }
    public function setBaud($baud)
    {
        $this->baud = (int)$baud;
    }

    /** Normalize PH numbers to +63xxxxxxxxxx */
    public function normalizeMsisdn($raw)
    {
        $raw = trim((string)$raw);
        if ($raw === '') return '';

        // remove spaces, dashes, parentheses
        $n = preg_replace('/[^0-9+]/', '', $raw);

        // 09xxxxxxxxx -> +639xxxxxxxxx
        if (preg_match('/^09\d{9}$/', $n)) return '+63' . substr($n, 1);

        // 9xxxxxxxxx -> +639xxxxxxxxx
        if (preg_match('/^9\d{9}$/', $n)) return '+63' . $n;

        // 63xxxxxxxxxx -> +63xxxxxxxxxx
        if (preg_match('/^63\d{10}$/', $n)) return '+' . $n;

        // +63xxxxxxxxxx
        if (preg_match('/^\+63\d{10}$/', $n)) return $n;

        return '';
    }

    /** Send an SMS. Returns ['ok'=>bool,'message'=>string,'raw'=>string] */
    public function sendSms($to, $message)
    {
        $to = $this->normalizeMsisdn($to);
        $message = trim((string)$message);

        if ($to === '') return ['ok' => false, 'message' => 'Invalid recipient number', 'raw' => ''];
        if ($message === '') return ['ok' => false, 'message' => 'Empty message', 'raw' => ''];

        // Avoid control chars; keep it simple GSM 7-bit friendly
        $message = preg_replace("/[\x00-\x08\x0B\x0C\x0E-\x1F]/", " ", $message);
        // $message = mb_substr($message, 0, 140);

        // Set serial settings (macOS uses stty -f)
        @exec('stty -f ' . escapeshellarg($this->port) . ' ' . (int)$this->baud . ' cs8 -cstopb -parenb -echo');

        $fp = @fopen($this->port, 'r+');
        if (!$fp) {
            return ['ok' => false, 'message' => 'Cannot open serial port: ' . $this->port, 'raw' => ''];
        }

        stream_set_blocking($fp, false);
        stream_set_timeout($fp, $this->readTimeoutSec);

        $raw = '';
        $write = function ($cmd) use ($fp, &$raw) {
            $cmd = rtrim($cmd, "\r\n") . "\r";
            fwrite($fp, $cmd);
            usleep(150000);
        };
        $readAll = function ($maxLoops = 6) use ($fp, &$raw) {
            $out = '';
            for ($i = 0; $i < $maxLoops; $i++) {
                $chunk = fread($fp, 4096);
                if ($chunk !== false && $chunk !== '') {
                    $out .= $chunk;
                    // small pause to gather more
                    usleep(120000);
                    continue;
                }
                break;
            }
            $raw .= $out;
            return $out;
        };

        // Handshake + verbose errors
        $write("AT");
        $readAll();

        $write("AT+CMEE=2");
        $readAll();

        // SIM + registration quick check (optional but helpful)
        $write("AT+CSMINS?");
        $readAll();

        // SMS settings
        $write('AT+CSCS="GSM"');
        $readAll();

        $write('AT+CPMS="SM","SM","SM"');
        $readAll();

        $write("AT+CMGF=1");
        $resp = $readAll();

        if (stripos($resp . $raw, 'OK') === false && stripos($resp . $raw, '+CMGF') === false) {
            fclose($fp);
            return ['ok' => false, 'message' => 'Failed to set text mode (CMGF). Check SIM/network.', 'raw' => $raw];
        }

        // Start sending
        $write('AT+CMGS="' . $to . '"');
        $resp = $readAll();

        if (strpos($resp . $raw, '>') === false) {
            fclose($fp);
            return ['ok' => false, 'message' => 'No prompt ">" from CMGS. Not registered or SIM issue.', 'raw' => $raw];
        }

        // Send message + Ctrl+Z
        fwrite($fp, $message);
        fwrite($fp, chr(26)); // Ctrl+Z
        usleep(800000);

        $resp2 = $readAll(10);
        fclose($fp);

        if (stripos($resp2 . $raw, '+CMGS:') !== false && stripos($resp2 . $raw, 'OK') !== false) {
            return ['ok' => true, 'message' => 'SMS sent', 'raw' => $raw];
        }

        return ['ok' => false, 'message' => 'SMS send failed', 'raw' => $raw];
    }
}
