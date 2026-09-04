<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Tos_model extends CI_Model
{
    private $table = 'tos';
    private $topics_table = 'tos_topics';

    public function count_by_user($user_id)
    {
        $this->db->select('t.id')->from($this->table . ' t')
            ->join('subjects s', 's.id = t.subject_id')
            ->where('s.instructor_id', $user_id);
        return $this->db->count_all_results();
    }

    public function get_by_user($user_id, $limit = null, $offset = null)
    {
        $this->db->select('t.*, s.name as subject_name, s.code as subject_code')
            ->from($this->table . ' t')
            ->join('subjects s', 's.id = t.subject_id')
            ->where('s.instructor_id', $user_id)
            ->order_by('t.created_at', 'DESC');
        if ($limit !== null) $this->db->limit($limit, (int) $offset);
        return $this->db->get()->result();
    }

    public function get_by_id($id)
    {
        return $this->db->where('id', $id)->get($this->table)->row();
    }

    public function get_owned($id, $user_id)
    {
        return $this->db->select('t.*')->from($this->table . ' t')
            ->join('subjects s', 's.id = t.subject_id')
            ->where('t.id', $id)->where('s.instructor_id', $user_id)
            ->get()->row();
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
        $this->db->where('tos_id', $id)->delete($this->topics_table);
        return $this->db->where('id', $id)->delete($this->table);
    }

    public function get_topics($tos_id)
    {
        return $this->db->where('tos_id', $tos_id)
            ->order_by('sort_order', 'ASC')->get($this->topics_table)->result();
    }

    public function add_topic($data)
    {
        $data['id'] = $this->_uuid();
        $this->db->insert($this->topics_table, $data);
        return $data['id'];
    }

    public function delete_topic($topic_id)
    {
        return $this->db->where('id', $topic_id)->delete($this->topics_table);
    }

    /* ------------------------------------------------------------------
       Dashboard analytics
       ------------------------------------------------------------------ */

    /** Number of TOS blueprints created under the user's subjects in a range. */
    public function count_created_between($user_id, $from, $to)
    {
        $this->db->from($this->table . ' t')
            ->join('subjects s', 's.id = t.subject_id')
            ->where('s.instructor_id', $user_id)
            ->where('t.created_at >=', $from)
            ->where('t.created_at <', $to);
        return $this->db->count_all_results();
    }

    /** Total planned items across all of the user's blueprints. */
    public function total_items_by_user($user_id)
    {
        $row = $this->db->select('COALESCE(SUM(t.total_items), 0) AS total', FALSE)
            ->from($this->table . ' t')
            ->join('subjects s', 's.id = t.subject_id')
            ->where('s.instructor_id', $user_id)
            ->get()->row();

        return $row ? (int) $row->total : 0;
    }


    private function _uuid()
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
