<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Exam_model extends CI_Model
{
    private $table = 'exams';
    private $eq_table = 'exam_questions';

    public function count_by_user($user_id)
    {
        return $this->db->where('created_by', $user_id)->count_all_results($this->table);
    }

    public function get_by_user($user_id, $limit = null, $offset = null)
    {
        $this->db->select('e.*, s.name as subject_name')
            ->from($this->table . ' e')
            ->join('subjects s', 's.id = e.subject_id', 'left')
            ->where('e.created_by', $user_id)
            ->order_by('e.created_at', 'DESC');
        if ($limit !== null) $this->db->limit($limit, (int) $offset);
        return $this->db->get()->result();
    }

    /** Get exams with question counts — paginated. */
    public function get_with_counts($user_id, $filters = [], $limit = null, $offset = null)
    {
        $rows = $this->db->select('e.*, s.name AS subject_name,
                (SELECT COUNT(*) FROM ' . $this->eq_table . ' eq WHERE eq.exam_id = e.id) AS question_count', FALSE)
            ->from($this->table . ' e')
            ->join('subjects s', 's.id = e.subject_id', 'left')
            ->where('e.created_by', $user_id);
        if (!empty($filters['subject_id'])) $this->db->where('e.subject_id', $filters['subject_id']);
        $this->db->order_by('e.created_at', 'DESC');
        if ($limit !== null) $this->db->limit($limit, (int) $offset);
        return $this->db->get()->result();
    }

    public function get_recent_by_user($user_id, $limit = 5)
    {
        return $this->db->select('e.*, s.name as subject_name')
            ->from($this->table . ' e')
            ->join('subjects s', 's.id = e.subject_id', 'left')
            ->where('e.created_by', $user_id)
            ->order_by('e.created_at', 'DESC')
            ->limit($limit)
            ->get()->result();
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
        $this->db->where('exam_id', $id)->delete($this->eq_table);
        return $this->db->where('id', $id)->delete($this->table);
    }

    /**
     * Delete several exams at once, scoped to the owner. Ids the user does
     * not own are ignored rather than rejected, so a partially forged
     * selection cannot delete anything it should not.
     *
     * @return int  number of exams actually removed
     */
    public function delete_many(array $ids, $user_id)
    {
        $ids = array_values(array_filter(array_unique($ids), 'strlen'));
        if (empty($ids)) return 0;

        $owned = $this->db->select('id')
            ->where('created_by', $user_id)
            ->where_in('id', $ids)
            ->get($this->table)->result();

        $owned_ids = array_map(function ($row) { return $row->id; }, $owned);
        if (empty($owned_ids)) return 0;

        $this->db->trans_start();
        $this->db->where_in('exam_id', $owned_ids)->delete($this->eq_table);
        $this->db->where_in('id', $owned_ids)->delete($this->table);
        $this->db->trans_complete();

        return $this->db->trans_status() ? count($owned_ids) : 0;
    }

    /** Exam counts per subject id, for the subjects list. */
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

    public function add_question($exam_id, $question_id, $sort_order)
    {
        return $this->db->insert($this->eq_table, [
            'exam_id' => $exam_id, 'question_id' => $question_id, 'sort_order' => $sort_order
        ]);
    }

    public function get_questions($exam_id)
    {
        return $this->db->select('q.*, eq.sort_order')
            ->from($this->eq_table . ' eq')
            ->join('questions q', 'q.id = eq.question_id')
            ->where('eq.exam_id', $exam_id)
            ->order_by('eq.sort_order', 'ASC')
            ->get()->result();
    }

    /* ------------------------------------------------------------------
       Dashboard analytics
       ------------------------------------------------------------------ */

    /** Number of exams created by the user within a datetime range. */
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

    /** Exam counts grouped by status. */
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

    /** Recent exams with subject name and item count. */
    public function get_recent_with_counts($user_id, $limit = 5)
    {
        $rows = $this->db->select('e.*, s.name AS subject_name, s.code AS subject_code,
                (SELECT COUNT(*) FROM ' . $this->eq_table . ' eq WHERE eq.exam_id = e.id) AS item_count', FALSE)
            ->from($this->table . ' e')
            ->join('subjects s', 's.id = e.subject_id', 'left')
            ->where('e.created_by', $user_id)
            ->order_by('e.created_at', 'DESC')
            ->limit($limit)
            ->get()->result();

        return $rows;
    }


    private function _uuid()
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
