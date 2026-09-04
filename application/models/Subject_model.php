<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Subject_model extends CI_Model
{
    private $table = 'subjects';

    public function count_by_user($user_id)
    {
        return $this->db->where('instructor_id', $user_id)->count_all_results($this->table);
    }

    public function get_by_user($user_id)
    {
        return $this->db->where('instructor_id', $user_id)
            ->order_by('created_at', 'DESC')
            ->get($this->table)->result();
    }

    public function get_recent_by_user($user_id, $limit = 5)
    {
        return $this->db->where('instructor_id', $user_id)
            ->order_by('created_at', 'DESC')
            ->limit($limit)
            ->get($this->table)->result();
    }

    public function get_by_id($id)
    {
        return $this->db->where('id', $id)->get($this->table)->row();
    }

    /** Get subject only if owned by the user (IDOR protection). */
    public function get_owned($id, $user_id)
    {
        return $this->db->where('id', $id)->where('instructor_id', $user_id)
            ->get($this->table)->row();
    }

    public function create($data)
    {
        $data['id'] = $this->_uuid();
        $this->db->insert($this->table, $data);
        return $this->db->affected_rows() > 0 ? $data['id'] : false;
    }

    public function update($id, $data)
    {
        return $this->db->where('id', $id)->update($this->table, $data);
    }

    public function delete($id)
    {
        return $this->db->where('id', $id)->delete($this->table);
    }

    private function _uuid()
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
