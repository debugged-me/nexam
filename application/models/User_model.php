<?php
defined('BASEPATH') or exit('No direct script access allowed');

class User_model extends CI_Model
{
    public function find_by_email($email)
    {
        return $this->db->where('email', $email)->get('users')->row();
    }

    public function find_by_id($id)
    {
        return $this->db->where('id', $id)->get('users')->row();
    }

    public function verify_credentials($email, $password)
    {
        $user = $this->find_by_email($email);
        if (!$user) {
            return false;
        }
        if (!password_verify($password, $user->password_hash)) {
            return false;
        }
        return $user;
    }

    /** Create a new user. Returns the UUID id or false on failure. */
    public function create_user($email, $password, $full_name)
    {
        $id = $this->_generate_uuid();

        $this->db->insert('users', [
            'id'            => $id,
            'email'         => $email,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'full_name'     => $full_name,
            'role'          => 'instructor',
            'email_verified' => 0,
        ]);

        return $this->db->affected_rows() > 0 ? $id : false;
    }

    /** Update a user's password. */
    public function update_password($user_id, $password)
    {
        return $this->db->where('id', $user_id)->update('users', [
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        ]);
    }

    /** Mark email as verified. */
    public function mark_email_verified($user_id)
    {
        return $this->db->where('id', $user_id)->update('users', [
            'email_verified' => 1,
        ]);
    }

    /** Generate a 6-digit OTP, store it, and return the plain code. */
    public function generate_otp($user_id)
    {
        // Invalidate previous unused codes
        $this->db->where('user_id', $user_id)->where('used', 0)->update('otp_codes', ['used' => 1]);

        $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $id   = $this->_generate_uuid();

        $this->db->insert('otp_codes', [
            'id'         => $id,
            'user_id'    => $user_id,
            'code'       => $code,
            'used'       => 0,
            'expires_at' => date('Y-m-d H:i:s', time() + 900), // 15 minutes
        ]);

        return $code;
    }

    /** Verify an OTP code. Returns true if valid and not expired. */
    public function verify_otp($user_id, $code)
    {
        $row = $this->db
            ->where('user_id', $user_id)
            ->where('code', $code)
            ->where('used', 0)
            ->where('expires_at >', date('Y-m-d H:i:s'))
            ->order_by('created_at', 'DESC')
            ->get('otp_codes')
            ->row();

        if (!$row) {
            return false;
        }

        // Mark as used
        $this->db->where('id', $row->id)->update('otp_codes', ['used' => 1]);

        return true;
    }

    /** Generate a UUID v4 string. */
    private function _generate_uuid()
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
