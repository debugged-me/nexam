<?php
defined('BASEPATH') or exit('No direct script access allowed');

class User_model extends CI_Model
{
    public function find_by_email($email)
    {
        return $this->db->where('email', $email)->get('users')->row();
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
}
