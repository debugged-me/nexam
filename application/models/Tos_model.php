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

    public function get_by_user($user_id, $filters = [], $limit = null, $offset = null)
    {
        $this->db->select('t.*, s.name as subject_name, s.code as subject_code,
                (SELECT COUNT(*) FROM ' . $this->topics_table . ' tt WHERE tt.tos_id = t.id) AS topic_count', FALSE)
            ->from($this->table . ' t')
            ->join('subjects s', 's.id = t.subject_id')
            ->where('s.instructor_id', $user_id);
        if (!empty($filters['subject_id'])) $this->db->where('t.subject_id', $filters['subject_id']);
        $this->db->order_by('t.created_at', 'DESC');
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

    /**
     * Delete several blueprints at once.
     *
     * Ownership is re-derived from the database rather than trusted from the
     * request: only ids that resolve to a subject owned by $user_id are
     * touched, so a forged id in the POST body is a no-op.
     *
     * @return int  number of blueprints actually removed
     */
    public function delete_many(array $ids, $user_id)
    {
        $ids = array_values(array_filter(array_unique($ids), 'strlen'));
        if (empty($ids)) return 0;

        $owned = $this->db->select('t.id')
            ->from($this->table . ' t')
            ->join('subjects s', 's.id = t.subject_id')
            ->where('s.instructor_id', $user_id)
            ->where('t.status', 'draft')
            ->where_in('t.id', $ids)
            ->get()->result();

        $owned_ids = array_map(function ($row) { return $row->id; }, $owned);
        if (empty($owned_ids)) return 0;

        $this->db->trans_start();
        $this->db->where_in('tos_id', $owned_ids)->delete($this->topics_table);
        $this->db->where_in('id', $owned_ids)->delete($this->table);
        $this->db->trans_complete();

        return $this->db->trans_status() ? count($owned_ids) : 0;
    }

    /** Blueprint counts per subject id, for the subjects list. */
    public function counts_by_subject($user_id)
    {
        $rows = $this->db->select('t.subject_id, COUNT(*) AS c', FALSE)
            ->from($this->table . ' t')
            ->join('subjects s', 's.id = t.subject_id')
            ->where('s.instructor_id', $user_id)
            ->group_by('t.subject_id')
            ->get()->result();

        $out = [];
        foreach ($rows as $r) $out[$r->subject_id] = (int) $r->c;
        return $out;
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

    public function delete_topic($topic_id, $tos_id)
    {
        return $this->db->where('id', $topic_id)
            ->where('tos_id', $tos_id)
            ->delete($this->topics_table);
    }

    /**
     * Recalculate tos_topics.item_count from instructional_hours — item
     * allocation is proportional to hours (largest-remainder rounding so the
     * counts sum exactly to tos.total_items). Mirrors the Node API's
     * recalcTopicItemCounts; run after any topic add/update/delete or a
     * total_items change.
     */
    public function recalc_item_counts($tos_id)
    {
        $tos = $this->db->select('total_items')->where('id', $tos_id)->get($this->table)->row();
        if (!$tos) return;

        $total_items = (int) $tos->total_items;
        $topics = $this->db->select('id, instructional_hours')
            ->where('tos_id', $tos_id)->order_by('sort_order', 'ASC')
            ->get($this->topics_table)->result();
        if (empty($topics)) return;

        $total_hours = 0;
        // Clamped like the Node mirror (api/src/routes/tos.js recalcTopicItemCounts)
        // so a stray negative can never produce a negative item_count.
        foreach ($topics as $t) $total_hours += max(0, (int) $t->instructional_hours);

        $counts = [];
        $remainders = [];
        $allocated = 0;
        foreach ($topics as $t) {
            $share = $total_hours > 0 ? max(0, (int) $t->instructional_hours) / $total_hours : 1 / count($topics);
            $exact = $share * $total_items;
            $whole = (int) floor($exact);
            $counts[$t->id] = $whole;
            $remainders[] = ['id' => $t->id, 'remainder' => $exact - $whole];
            $allocated += $whole;
        }
        usort($remainders, function ($a, $b) { return $b['remainder'] <=> $a['remainder']; });
        foreach ($remainders as $r) {
            if ($allocated >= $total_items) break;
            $counts[$r['id']]++;
            $allocated++;
        }

        foreach ($topics as $t) {
            $this->db->where('id', $t->id)->update($this->topics_table, ['item_count' => $counts[$t->id]]);
        }
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
