<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Question_model extends CI_Model
{
    private $table = 'questions';

    public function count_by_user($user_id)
    {
        return $this->db->where('created_by', $user_id)->count_all_results($this->table);
    }

    public function count_by_user_filtered($user_id, $filters = [])
    {
        $this->db->where('created_by', $user_id);
        if (!empty($filters['subject_id'])) $this->db->where('subject_id', $filters['subject_id']);
        if (!empty($filters['bloom']))      $this->db->where('bloom', $filters['bloom']);
        if (!empty($filters['type']))       $this->db->where('type', $filters['type']);
        if (!empty($filters['topic']))      $this->db->like('topic', $filters['topic']);
        return $this->db->count_all_results($this->table);
    }

    public function get_by_user($user_id, $filters = [], $limit = null, $offset = null)
    {
        $this->db->where('created_by', $user_id);
        if (!empty($filters['subject_id'])) $this->db->where('subject_id', $filters['subject_id']);
        if (!empty($filters['bloom']))      $this->db->where('bloom', $filters['bloom']);
        if (!empty($filters['type']))       $this->db->where('type', $filters['type']);
        if (!empty($filters['topic']))      $this->db->like('topic', $filters['topic']);
        $this->db->order_by('created_at', 'DESC');
        if ($limit !== null) $this->db->limit($limit, (int) $offset);
        return $this->db->get($this->table)->result();
    }

    public function get_by_id($id)
    {
        return $this->db->where('id', $id)->get($this->table)->row();
    }

    public function get_owned($id, $user_id)
    {
        return $this->db->where('id', $id)->where('created_by', $user_id)->get($this->table)->row();
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

    /**
     * Delete several questions at once, scoped to the creator. Ids the user
     * does not own are silently skipped.
     *
     * @return int  number of questions actually removed
     */
    public function delete_many(array $ids, $user_id)
    {
        $ids = array_values(array_filter(array_unique($ids), 'strlen'));
        if (empty($ids)) return 0;

        $this->db->where('created_by', $user_id)->where_in('id', $ids)->delete($this->table);
        return $this->db->affected_rows();
    }

    /** Get questions by subject and bloom level (for exam generation). */
    public function get_by_subject_bloom($subject_id, $bloom, $limit, $user_id)
    {
        return $this->db->where('subject_id', $subject_id)
            ->where('created_by', $user_id)
            ->where('bloom', $bloom)
            ->where('status', 'active')
            ->order_by('RAND()')
            ->limit($limit)
            ->get($this->table)->result();
    }

    /** Count active questions in one owned subject/Bloom bucket. */
    public function count_active_by_subject_bloom($subject_id, $bloom, $user_id)
    {
        return $this->db->where('subject_id', $subject_id)
            ->where('created_by', $user_id)
            ->where('bloom', $bloom)
            ->where('status', 'active')
            ->count_all_results($this->table);
    }

    public function get_topics_by_user($user_id)
    {
        return $this->db->distinct()->select('topic')
            ->where('created_by', $user_id)->where('topic IS NOT NULL')
            ->order_by('topic')->get($this->table)->result();
    }

    /* ------------------------------------------------------------------
       Dashboard analytics
       ------------------------------------------------------------------ */

    /** Number of questions created by the user within a datetime range. */
    public function count_created_between($user_id, $from, $to)
    {
        return $this->db->where('created_by', $user_id)
            ->where('created_at >=', $from)
            ->where('created_at <', $to)
            ->count_all_results($this->table);
    }

    /** Daily created counts keyed by Y-m-d, for the given window. */
    public function daily_counts($user_id, $from, $to)
    {
        $rows = $this->db->select('DATE(created_at) AS d, COUNT(*) AS c', FALSE)
            ->from($this->table)
            ->where('created_by', $user_id)
            ->where('created_at >=', $from)
            ->where('created_at <', $to)
            ->group_by('d')
            ->get()->result();

        $out = [];
        foreach ($rows as $r) $out[$r->d] = (int) $r->c;
        return $out;
    }

    /** Question counts grouped by Bloom level. */
    public function bloom_distribution($user_id)
    {
        $rows = $this->db->select('bloom, COUNT(*) AS c', FALSE)
            ->from($this->table)
            ->where('created_by', $user_id)
            ->group_by('bloom')
            ->get()->result();

        $out = [];
        foreach ($rows as $r) $out[$r->bloom ? $r->bloom : 'unclassified'] = (int) $r->c;
        return $out;
    }

    /** Question counts grouped by workflow status (draft / approved / ...). */
    public function status_distribution($user_id)
    {
        $rows = $this->db->select('status, COUNT(*) AS c', FALSE)
            ->from($this->table)
            ->where('created_by', $user_id)
            ->group_by('status')
            ->get()->result();

        $out = [];
        foreach ($rows as $r) $out[$r->status] = (int) $r->c;
        return $out;
    }

    /** Question counts per subject id. */
    public function counts_by_subject($user_id)
    {
        $rows = $this->db->select('subject_id, COUNT(*) AS c', FALSE)
            ->from($this->table)
            ->where('created_by', $user_id)
            ->group_by('subject_id')
            ->get()->result();

        $out = [];
        foreach ($rows as $r) $out[$r->subject_id] = (int) $r->c;
        return $out;
    }


    private function _uuid()
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
