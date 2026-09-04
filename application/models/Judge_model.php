<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Judge_model extends CI_Model
{
    protected $table = 'judges';

    public function __construct()
    {
        parent::__construct();
        $this->load->database();
    }

    public function get_by_judge_id($judge_id)
    {
        return $this->db
            ->where('judge_id', $judge_id)
            ->where('is_active', 1)
            ->get($this->table)
            ->row();
    }

    public function set_temp_password($judge_id, $temp_password)
    {
        return $this->db
            ->where('judge_id', $judge_id)
            ->update($this->table, [
                'temp_password' => password_hash($temp_password, PASSWORD_DEFAULT),
                'updated_at' => date('Y-m-d H:i:s')
            ]);
    }

    public function validate_credentials($judge_id, $password)
    {
        $judge = $this->get_by_judge_id($judge_id);
        if (!$judge) {
            return false;
        }
        // Check primary password or temp password
        if (password_verify($password, $judge->password)) {
            return $judge;
        }
        if ($judge->temp_password && password_verify($password, $judge->temp_password)) {
            // Upgrade temp password to primary on successful login
            $this->db->where('id', $judge->id)->update($this->table, [
                'password' => $judge->temp_password,
                'temp_password' => null
            ]);
            return $judge;
        }
        return false;
    }
}
