<?php
defined('BASEPATH') or exit('No direct script access allowed');

/**
 * Scoring_model
 *
 * Central tabulation engine for Binibining Mati.
 *
 * Scoring rules (agreed with client):
 *  - Each segment (category) has a weight %. A candidate's contribution from a
 *    segment = (average raw score across judges / segment max) * weight.
 *  - Totals are CUMULATIVE across all scored segments (Q&A adds on top of the
 *    carried-over weighted segment totals).
 *  - Rounds (round_level on categories):
 *        0 = Preliminary  (scored by ALL candidates)        -> selects Top 10
 *        1 = Top 10 round (prelim Q&A, only Top 10 scored)  -> selects Top 5
 *        2 = Top 5 round  (final Q&A, only Top 5 scored)    -> winner & runners-up
 *  - Advancement between rounds is set MANUALLY by the admin (in_top10 / in_top5).
 */
class Scoring_model extends CI_Model
{
    public function __construct()
    {
        parent::__construct();
        $this->load->database();
    }

    /**
     * Headline counts for the public landing page (all live from the DB).
     *  - categories: active competition segments (round_level 0 — the categories
     *    candidates compete in; Q&A elimination rounds are not counted).
     *  - judges:     active judges on the panel.
     *  - candidates: active candidates.
     */
    public function landing_stats()
    {
        return [
            'categories' => (int)$this->db->where('is_active', 1)->where('round_level', 0)->count_all_results('categories'),
            'judges'     => (int)$this->db->where('is_active', 1)->count_all_results('judges'),
            'candidates' => (int)$this->db->where('is_active', 1)->count_all_results('candidates'),
        ];
    }

    /**
     * The current public leaderboard. Detects the active round from the admin's
     * advancement flags and returns cumulative weighted standings for it,
     * normalized to a clean 0-100 "score" so the scale is the same every round.
     *
     * @return array{round_level:int, round_label:string, max_weight:float, rows:array}
     */
    public function current_leaderboard()
    {
        $top5  = $this->advanced_ids('in_top5');
        $top10 = $this->advanced_ids('in_top10');

        // Standalone per round: each stage is scored on its own segment(s) only.
        if (!empty($top5)) {
            $levels = [2];          // Final Round only
            $ids = $top5;
            $label = 'Final Round — Top 5';
        } elseif (!empty($top10)) {
            $levels = [1];          // Preliminary Q&A only
            $ids = $top10;
            $label = 'Top 10 Round';
        } else {
            $levels = [0];          // Preliminary
            $ids = null;
            $label = 'Preliminary';
        }

        $list = $this->standings($levels, $ids);

        // Max possible = sum of the included segments' weights.
        $max_weight = 0.0;
        foreach ($this->segments($levels) as $s) {
            $max_weight += floatval($s->weight);
        }

        $rows = [];
        foreach ($list as $c) {
            $rows[] = [
                'id'               => (int)$c->id,
                'candidate_number' => $c->candidate_number,
                'total'            => round((float)$c->total, 2),
                'score'            => $max_weight > 0 ? round($c->total / $max_weight * 100, 2) : 0.0,
            ];
        }

        return [
            'round_level' => max($levels),
            'round_label' => $label,
            'max_weight'  => $max_weight,
            'rows'        => $rows,
        ];
    }

    /** Categories (segments), optionally filtered to a set of round levels. */
    public function segments($round_levels = null)
    {
        $this->db->where('is_active', 1)->order_by('round_level', 'ASC')->order_by('order_num', 'ASC');
        if ($round_levels !== null) {
            $this->db->where_in('round_level', (array)$round_levels);
        }
        return $this->db->get('categories')->result();
    }

    /** Sum of criteria max_score for a segment (the segment's maximum possible raw score). */
    public function segment_max($category_id)
    {
        $row = $this->db->select('SUM(max_score) AS m')
            ->where('category_id', $category_id)
            ->where('is_active', 1)
            ->get('criteria')->row();
        return $row && $row->m ? floatval($row->m) : 0.0;
    }

    /**
     * Per-candidate results for one segment.
     * Returns rows ordered by weighted contribution desc, each with:
     *   candidate_id, candidate_number, name, barangay, raw_total (sum of all judge scores),
     *   judge_count, avg_raw (per-judge average), weighted (contribution toward grand total).
     */
    public function segment_results($category, $candidate_filter = null)
    {
        $max = $this->segment_max($category->id);
        $weight = floatval($category->weight);

        $this->db->select('scores.candidate_id, candidates.candidate_number, candidates.name, candidates.barangay,
                           SUM(scores.score) AS raw_total,
                           COUNT(DISTINCT scores.judge_id) AS judge_count');
        $this->db->join('candidates', 'candidates.id = scores.candidate_id');
        $this->db->where('scores.category_id', $category->id);
        if (is_array($candidate_filter)) {
            if (empty($candidate_filter)) return [];
            $this->db->where_in('scores.candidate_id', $candidate_filter);
        }
        $this->db->group_by('scores.candidate_id');
        $rows = $this->db->get('scores')->result();

        foreach ($rows as $r) {
            $jc = max(1, (int)$r->judge_count);
            $r->avg_raw = floatval($r->raw_total) / $jc;        // average judge score (out of $max)
            $r->segment_max = $max;
            $r->weight = $weight;
            $r->weighted = $max > 0 ? ($r->avg_raw / $max) * $weight : 0.0;
        }

        usort($rows, function ($a, $b) {
            return $b->weighted <=> $a->weighted;
        });
        return $rows;
    }

    /**
     * Per-judge individual ratings for one segment.
     *
     * Returns the segment's judge panel, the candidates in scope (by number),
     * and a matrix of each judge's RAW total score (sum across that segment's
     * criteria) for every candidate. Cells with no entry mean the judge has not
     * scored that candidate yet.
     *
     * @param  object     $category         a categories row
     * @param  array|null $candidate_filter restrict to these candidate ids (e.g. current Top 10)
     * @return array{judges:array, candidates:array, max:float, weight:float, matrix:array}
     *         matrix[candidate_id][judge_id] => raw total (float)
     */
    public function segment_judge_matrix($category, $candidate_filter = null)
    {
        $judges = $this->segment_judges($category->id);
        $max    = $this->segment_max($category->id);

        // Candidates in scope, ordered by number. An explicit-but-empty filter
        // means the round has no advancers yet -> no candidates.
        $candidates = [];
        if (!(is_array($candidate_filter) && empty($candidate_filter))) {
            $this->db->where('is_active', 1)->order_by('CAST(candidate_number AS UNSIGNED)', 'ASC', FALSE);
            if (is_array($candidate_filter)) {
                $this->db->where_in('id', $candidate_filter);
            }
            $candidates = $this->db->get('candidates')->result();
        }

        // Each judge's raw total per candidate (summed across this segment's criteria).
        $matrix = [];
        if (!empty($candidates)) {
            $cand_ids = array_map(function ($c) {
                return (int)$c->id;
            }, $candidates);
            $rows = $this->db->select('candidate_id, judge_id, SUM(score) AS raw_total')
                ->where('category_id', $category->id)
                ->where_in('candidate_id', $cand_ids)
                ->group_by(['candidate_id', 'judge_id'])
                ->get('scores')->result();
            foreach ($rows as $r) {
                $matrix[(int)$r->candidate_id][$r->judge_id] = floatval($r->raw_total);
            }
        }

        return [
            'judges'     => $judges,
            'candidates' => $candidates,
            'max'        => $max,
            'weight'     => floatval($category->weight),
            'matrix'     => $matrix,
        ];
    }

    /**
     * One judge's own score sheet for a segment: the segment's criteria, the
     * candidates in scope, and THIS judge's score per criterion (plus the raw
     * total per candidate). Used by the judge-facing printable sheet so judges
     * can export their own ratings without the admin.
     *
     * @param  string     $judge_id         judges.judge_id of the logged-in judge
     * @param  object     $category         a categories row
     * @param  array|null $candidate_filter restrict to these candidate ids (round scope)
     * @return array{criteria:array, candidates:array, max:float, weight:float, scores:array, totals:array}
     *         scores[candidate_id][criteria_id] => score; totals[candidate_id] => raw total
     */
    public function judge_score_sheet($judge_id, $category, $candidate_filter = null)
    {
        $criteria = $this->db->where('category_id', $category->id)->where('is_active', 1)
            ->order_by('order_num', 'ASC')->get('criteria')->result();

        $max = 0.0;
        foreach ($criteria as $cr) {
            $max += floatval($cr->max_score);
        }

        // Candidates in scope, ordered by number. Empty-but-array filter means
        // the round has no advancers yet -> no candidates.
        $candidates = [];
        if (!(is_array($candidate_filter) && empty($candidate_filter))) {
            $this->db->where('is_active', 1)->order_by('CAST(candidate_number AS UNSIGNED)', 'ASC', FALSE);
            if (is_array($candidate_filter)) {
                $this->db->where_in('id', $candidate_filter);
            }
            $candidates = $this->db->get('candidates')->result();
        }

        $scores = [];
        $totals = [];
        if (!empty($candidates)) {
            $cand_ids = array_map(function ($c) {
                return (int)$c->id;
            }, $candidates);
            $rows = $this->db->select('candidate_id, criteria_id, score')
                ->where('category_id', $category->id)
                ->where('judge_id', $judge_id)
                ->where_in('candidate_id', $cand_ids)
                ->get('scores')->result();
            foreach ($rows as $r) {
                $cid = (int)$r->candidate_id;
                $scores[$cid][(int)$r->criteria_id] = floatval($r->score);
                $totals[$cid] = ($totals[$cid] ?? 0.0) + floatval($r->score);
            }
        }

        return [
            'criteria'   => $criteria,
            'candidates' => $candidates,
            'max'        => $max,
            'weight'     => floatval($category->weight),
            'scores'     => $scores,
            'totals'     => $totals,
        ];
    }

    /**
     * Cumulative weighted standings across a set of round levels.
     *
     * @param array      $round_levels  e.g. [0] for prelim, [0,1] for Top 5 selection, [0,1,2] for final
     * @param array|null $candidate_ids restrict to these candidate ids (e.g. current Top 10)
     * @return array of objects: id, candidate_number, name, total, per (segment_id => weighted), in_top10, in_top5
     */
    public function standings($round_levels, $candidate_ids = null)
    {
        $segments = $this->segments($round_levels);

        $this->db->where('is_active', 1)->order_by('CAST(candidate_number AS UNSIGNED)', 'ASC', FALSE);
        if (is_array($candidate_ids)) {
            if (empty($candidate_ids)) return [];
            $this->db->where_in('id', $candidate_ids);
        }
        $candidates = $this->db->get('candidates')->result();

        // index candidates
        $out = [];
        foreach ($candidates as $c) {
            $out[$c->id] = (object)[
                'id' => $c->id,
                'candidate_number' => $c->candidate_number,
                'name' => $c->name,
                'barangay' => isset($c->barangay) ? $c->barangay : '',
                'in_top10' => isset($c->in_top10) ? (int)$c->in_top10 : 0,
                'in_top5' => isset($c->in_top5) ? (int)$c->in_top5 : 0,
                'total' => 0.0,
                'per' => [],
            ];
        }

        foreach ($segments as $seg) {
            $results = $this->segment_results($seg, $candidate_ids);
            foreach ($results as $r) {
                if (!isset($out[$r->candidate_id])) continue;
                $out[$r->candidate_id]->per[$seg->id] = $r->weighted;
                $out[$r->candidate_id]->total += $r->weighted;
            }
        }

        $list = array_values($out);
        usort($list, function ($a, $b) {
            return $b->total <=> $a->total;
        });
        return $list;
    }

    /** Candidate ids currently flagged into a round. $flag = 'in_top10' | 'in_top5'. */
    public function advanced_ids($flag)
    {
        $rows = $this->db->select('id')->where('is_active', 1)->where($flag, 1)->get('candidates')->result();
        return array_map(function ($r) {
            return (int)$r->id;
        }, $rows);
    }

    /** Judges assigned to a segment; falls back to all active judges if none assigned. */
    public function segment_judges($category_id)
    {
        $assigned = $this->db->select('judges.*')
            ->join('judges', 'judges.judge_id = category_judges.judge_id')
            ->where('category_judges.category_id', $category_id)
            ->where('judges.is_active', 1)
            ->order_by('judges.name', 'ASC')
            ->get('category_judges')->result();
        if (!empty($assigned)) return $assigned;
        return $this->db->where('is_active', 1)->order_by('name', 'ASC')->get('judges')->result();
    }

    /** Judge_ids assigned to a segment (empty array = open to all). */
    public function assigned_judge_ids($category_id)
    {
        $rows = $this->db->select('judge_id')->where('category_id', $category_id)->get('category_judges')->result();
        return array_map(function ($r) {
            return $r->judge_id;
        }, $rows);
    }

    /** Category ids a given judge is assigned to (empty = assigned to none explicitly). */
    public function judge_category_ids($judge_id)
    {
        $rows = $this->db->select('category_id')->where('judge_id', $judge_id)->get('category_judges')->result();
        return array_map(function ($r) {
            return (int)$r->category_id;
        }, $rows);
    }
}
