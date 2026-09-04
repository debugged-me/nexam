<?php defined('BASEPATH') OR exit('No direct script access allowed');

class MY_Email extends CI_Email
{
    public function from($from, $name = '', $return_path = NULL)
    {
        $resolvedFrom = $this->resolveConfiguredSender($from);

        if ($return_path === NULL || trim((string) $return_path) === '' || srms_is_legacy_no_reply_email($return_path))
        {
            $return_path = $resolvedFrom;
        }

        return parent::from($resolvedFrom, $name, $return_path);
    }

    private function resolveConfiguredSender($from)
    {
        $normalizedFrom = trim((string) $from);

        if (preg_match('/\<(.*)\>/', $normalizedFrom, $match))
        {
            $normalizedFrom = trim((string) $match[1]);
        }

        if ($normalizedFrom !== '' && !srms_is_legacy_no_reply_email($normalizedFrom))
        {
            return $normalizedFrom;
        }

        $configuredSender = trim((string) $this->smtp_user);
        if ($configuredSender === '')
        {
            $configuredSender = srms_get_sender_email();
        }

        return $configuredSender !== '' ? $configuredSender : $normalizedFrom;
    }
}
