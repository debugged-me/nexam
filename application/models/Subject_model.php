<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Subject_model extends CI_Model
{
    private $table = 'subjects';

    public function count_by_user($user_id)
    {
        return $this->db->where('instructor_id', $user_id)->count_all_results($this->table);
    }

    public function get_by_user($user_id, $limit = null, $offset = null)
    {
        $this->db->where('instructor_id', $user_id)
            ->order_by('created_at', 'DESC');
        if ($limit !== null) $this->db->limit($limit, (int) $offset);
        return $this->db->get($this->table)->result();
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
        $this->db->trans_start();
        // The legacy questions table has no subject foreign key, so remove
        // those rows explicitly. Their exam-question links cascade in MySQL.
        $this->db->where('subject_id', $id)->delete('questions');
        // TOS, topics, exams, and exam-question links use cascading FKs.
        $this->db->where('id', $id)->delete($this->table);
        $this->db->trans_complete();

        return $this->db->trans_status();
    }

    /**
     * Delete several subjects at once, together with the questions that hang
     * off them. Ownership is re-checked against the database, so ids that do
     * not belong to $user_id are dropped from the batch.
     *
     * @return int  number of subjects actually removed
     */
    public function delete_many(array $ids, $user_id)
    {
        $ids = array_values(array_filter(array_unique($ids), 'strlen'));
        if (empty($ids)) return 0;

        $owned = $this->db->select('id')
            ->where('instructor_id', $user_id)
            ->where_in('id', $ids)
            ->get($this->table)->result();

        $owned_ids = array_map(function ($row) { return $row->id; }, $owned);
        if (empty($owned_ids)) return 0;

        $this->db->trans_start();
        // Questions carry no subject foreign key, so clear them explicitly.
        // TOS, topics, exams and exam-question links cascade in MySQL.
        $this->db->where_in('subject_id', $owned_ids)->delete('questions');
        $this->db->where_in('id', $owned_ids)->delete($this->table);
        $this->db->trans_complete();

        return $this->db->trans_status() ? count($owned_ids) : 0;
    }

    /* ------------------------------------------------------------------
       Dashboard analytics
       ------------------------------------------------------------------ */

    /** Number of subjects created by the user within a datetime range. */
    public function count_created_between($user_id, $from, $to)
    {
        return $this->db->where('instructor_id', $user_id)
            ->where('created_at >=', $from)
            ->where('created_at <', $to)
            ->count_all_results($this->table);
    }


    private function _uuid()
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
