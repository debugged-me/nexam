<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Judgedashboard extends CI_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->load->library('session');
        $this->load->database();
        $this->load->model('Judge_model');
        $this->load->model('Scoring_model');
        $this->check_judge_auth();
    }

    /** Active event id (falls back to most recent). */
    private function active_event_id()
    {
        $ev = $this->db->where('is_active', 1)->order_by('id', 'DESC')->get('events')->row();
        if (!$ev) $ev = $this->db->order_by('id', 'DESC')->get('events')->row();
        return $ev ? (int)$ev->id : 0;
    }

    /** Active candidate ids that should be scored for a segment's round level. */
    private function candidates_for_round($round_level)
    {
        if ((int)$round_level === 1) {
            return $this->Scoring_model->advanced_ids('in_top10');
        }
        if ((int)$round_level === 2) {
            return $this->Scoring_model->advanced_ids('in_top5');
        }
        // Preliminary: everyone active
        $rows = $this->db->select('id')->where('is_active', 1)->get('candidates')->result();
        return array_map(function ($r) {
            return (int)$r->id;
        }, $rows);
    }

    private function check_judge_auth()
    {
        if (!$this->session->userdata('judge_id') && !$this->session->userdata('admin_logged_in')) {
            redirect('login/login_page');
        }

        // Tabulators reach this controller only for the results page — they have
        // no judging session and must not enter scores via the "admin viewing" path.
        if ($this->session->userdata('admin_role') === 'tabulator') {
            $allowed = ['tabulation', 'judge_results', 'logout'];
            if (!in_array($this->router->fetch_method(), $allowed)) {
                redirect('judgedashboard/tabulation');
            }
        }
    }

    /**
     * Whether the logged-in judge may score this category. The rule is
     * category-based: if a category has an assigned panel, ONLY those judges may
     * score it (everyone else — including judges assigned to nothing — is locked
     * out). A category with an empty panel is open to all judges. Admins viewing
     * the portal are never restricted.
     */
    private function judge_can_access_category($category_id)
    {
        $jid = $this->session->userdata('judge_id');
        if (!$jid) {
            return true; // admin viewing
        }
        $panel = $this->Scoring_model->assigned_judge_ids($category_id);
        return empty($panel) || in_array($jid, $panel, true);
    }

    /**
     * Whether a category is locked by the admin. A locked segment is read-only
     * for judges — they cannot open the score sheet or save scores for it.
     * Admins viewing the portal (no judge session) are never blocked.
     */
    private function category_is_locked($category_id)
    {
        if (!$this->session->userdata('judge_id')) {
            return false; // admin viewing
        }
        $cat = $this->db->select('is_locked')->where('id', $category_id)->get('categories')->row();
        return $cat ? !empty($cat->is_locked) : false;
    }

    private function judge_info()
    {
        $jid = $this->session->userdata('judge_id');
        if ($jid) {
            return $this->Judge_model->get_by_judge_id($jid);
        }
        // Admin viewing
        return (object)['name' => $this->session->userdata('admin_name') ?? 'Administrator', 'judge_id' => 'ADMIN'];
    }

    public function index()
    {
        $data['judge'] = $this->judge_info();
        $data['page_title'] = 'Judge Dashboard';

        // Admins viewing the portal are never blocked by a segment lock.
        $data['is_admin_view'] = !$this->session->userdata('judge_id');

        // Get active event
        $data['event'] = $this->db->where('is_active', 1)->order_by('id', 'DESC')->get('events')->row();

        // Categories / segments
        $jid = $this->session->userdata('judge_id');
        $all_categories = $this->db->where('is_active', 1)->order_by('round_level', 'ASC')->order_by('order_num', 'ASC')->get('categories')->result();

        // Show a segment to this judge only if its panel is empty (open to all)
        // or this judge is on the panel. Admins (no judge_id) see everything.
        if ($jid) {
            // category_id => [judge_id, ...] panel, fetched once.
            $panel_map = [];
            foreach ($this->db->get('category_judges')->result() as $r) {
                $panel_map[(int)$r->category_id][] = $r->judge_id;
            }
            $all_categories = array_values(array_filter($all_categories, function ($c) use ($jid, $panel_map) {
                $panel = $panel_map[(int)$c->id] ?? [];
                return empty($panel) || in_array($jid, $panel, true);
            }));
        }
        $data['categories'] = $all_categories;

        // Candidate counts per round (to show "locked" state when a round hasn't been cut yet)
        $data['round_counts'] = [
            0 => count($this->candidates_for_round(0)),
            1 => count($this->candidates_for_round(1)),
            2 => count($this->candidates_for_round(2)),
        ];

        // Score summary per category (how many of the round's candidates this judge has scored)
        $data['category_scores'] = [];
        $data['round_candidate_counts'] = [];
        foreach ($data['categories'] as $cat) {
            $round_ids = $this->candidates_for_round($cat->round_level ?? 0);
            $data['round_candidate_counts'][$cat->id] = count($round_ids);

            if (empty($round_ids)) {
                // No candidates in this round yet — skip the query so the builder
                // isn't left in a dirty state that would leak into the next query.
                $data['category_scores'][$cat->id] = [];
            } else {
                $this->db->select('scores.candidate_id, SUM(scores.score) as total_score');
                $this->db->where('scores.category_id', $cat->id);
                $this->db->where('scores.judge_id', $jid);
                $this->db->where_in('scores.candidate_id', $round_ids);
                $this->db->group_by('scores.candidate_id');
                $data['category_scores'][$cat->id] = $this->db->get('scores')->result();
            }
        }

        $this->load->view('judge_dashboard', $data);
    }

    public function score($category_id = null)
    {
        $data['judge'] = $this->judge_info();
        $data['page_title'] = 'Score Entry';

        if (!$category_id) {
            redirect('judgedashboard');
        }

        $data['category'] = $this->db->where('id', $category_id)->get('categories')->row();
        if (!$data['category']) {
            show_404();
        }

        // A judge with an explicit panel can only open their assigned segments.
        if (!$this->judge_can_access_category($category_id)) {
            $this->session->set_flashdata('error', 'You are not assigned to score this segment.');
            redirect('judgedashboard');
        }

        // A locked segment is read-only for judges.
        if ($this->category_is_locked($category_id)) {
            $this->session->set_flashdata('error', 'This segment is locked. Scoring is closed.');
            redirect('judgedashboard');
        }

        // Get criteria for this category
        $data['criteria'] = $this->db->where('category_id', $category_id)->where('is_active', 1)->order_by('order_num', 'ASC')->get('criteria')->result();

        // Candidates for this segment's round (number only). Top 10 / Top 5 rounds
        // only show the candidates the admin has advanced.
        $round_ids = $this->candidates_for_round($data['category']->round_level ?? 0);
        $data['round_level'] = (int)($data['category']->round_level ?? 0);
        if (empty($round_ids)) {
            $data['candidates'] = [];
        } else {
            $data['candidates'] = $this->db->where('is_active', 1)->where_in('id', $round_ids)
                ->order_by('CAST(candidate_number AS UNSIGNED)', 'ASC', FALSE)->get('candidates')->result();
        }

        $jid = $this->session->userdata('judge_id');

        // Get existing scores for this judge + category
        $this->db->select('scores.*, candidates.candidate_number');
        $this->db->join('candidates', 'candidates.id = scores.candidate_id');
        $existing = $this->db->where('scores.category_id', $category_id)->where('scores.judge_id', $jid)->get('scores')->result();

        // Build lookup: candidate_id => criteria_id => score
        $data['existing_scores'] = [];
        foreach ($existing as $s) {
            $data['existing_scores'][$s->candidate_id][$s->criteria_id] = $s->score;
        }

        $this->load->view('judge_score', $data);
    }

    public function submit_score()
    {
        $category_id = $this->input->post('category_id');
        $scores = $this->input->post('scores'); // [candidate_id][criteria_id] = score
        $notes = $this->input->post('notes');
        $judge_id = $this->session->userdata('judge_id');

        // Reject submissions for segments this judge isn't on the panel for.
        if (!$this->judge_can_access_category($category_id)) {
            $this->session->set_flashdata('error', 'You are not assigned to score this segment.');
            redirect('judgedashboard');
        }

        // Reject submissions for segments the admin has locked.
        if ($this->category_is_locked($category_id)) {
            $this->session->set_flashdata('error', 'This segment is locked. Scoring is closed.');
            redirect('judgedashboard');
        }

        if (!$scores || !is_array($scores)) {
            $this->session->set_flashdata('error', 'No scores submitted.');
            redirect('judgedashboard/score/' . $category_id);
        }

        $this->db->trans_start();

        foreach ($scores as $candidate_id => $criteria_scores) {
            foreach ($criteria_scores as $criteria_id => $score_val) {
                $score_val = floatval($score_val);
                if ($score_val <= 0) continue;

                $this->db->where([
                    'category_id' => $category_id,
                    'criteria_id' => $criteria_id,
                    'candidate_id' => $candidate_id,
                    'judge_id' => $judge_id,
                ]);
                $exists = $this->db->get('scores')->row();

                $score_data = [
                    'event_id' => $this->active_event_id(),
                    'category_id' => $category_id,
                    'criteria_id' => $criteria_id,
                    'candidate_id' => $candidate_id,
                    'judge_id' => $judge_id,
                    'score' => $score_val,
                    'notes' => $notes[$candidate_id][$criteria_id] ?? null,
                ];

                if ($exists) {
                    $this->db->where('id', $exists->id)->update('scores', $score_data);
                } else {
                    $this->db->insert('scores', $score_data);
                }
            }
        }

        $this->db->trans_complete();

        $this->session->set_flashdata('success', 'Scores saved successfully.');
        redirect('judgedashboard/score/' . $category_id);
    }

    /**
     * AJAX: save one candidate's scores for a category (used by the score-entry
     * modal). Returns JSON with the stored per-criterion values and the total.
     */
    public function save_candidate_score()
    {
        $this->output->set_content_type('application/json');

        $category_id  = (int) $this->input->post('category_id');
        $candidate_id = (int) $this->input->post('candidate_id');
        $posted       = $this->input->post('scores'); // [criteria_id] => value
        $notes        = $this->input->post('notes');  // [criteria_id] => note (optional)
        $judge_id     = $this->session->userdata('judge_id');

        if (!$judge_id) {
            return $this->output->set_output(json_encode(['success' => false, 'message' => 'Your judging session has expired. Please log in again.']));
        }
        if (!$this->judge_can_access_category($category_id)) {
            return $this->output->set_output(json_encode(['success' => false, 'message' => 'You are not assigned to score this segment.']));
        }
        if ($this->category_is_locked($category_id)) {
            return $this->output->set_output(json_encode(['success' => false, 'message' => 'This segment is locked. Scoring is closed.']));
        }
        if (!$candidate_id || !is_array($posted)) {
            return $this->output->set_output(json_encode(['success' => false, 'message' => 'Nothing to save.']));
        }

        // Score against this category's criteria, clamped to each criterion's max.
        $criteria = $this->db->where('category_id', $category_id)->where('is_active', 1)->get('criteria')->result();
        $event_id = $this->active_event_id();

        $this->db->trans_start();
        $total = 0.0;
        $out_scores = [];
        foreach ($criteria as $cr) {
            $val = isset($posted[$cr->id]) ? floatval($posted[$cr->id]) : 0.0;
            if ($val < 0) $val = 0.0;
            if ($val > floatval($cr->max_score)) $val = floatval($cr->max_score);
            $total += $val;
            $out_scores[$cr->id] = $val;

            $score_data = [
                'event_id'     => $event_id,
                'category_id'  => $category_id,
                'criteria_id'  => $cr->id,
                'candidate_id' => $candidate_id,
                'judge_id'     => $judge_id,
                'score'        => $val,
                'notes'        => is_array($notes) && isset($notes[$cr->id]) ? $notes[$cr->id] : null,
            ];

            $exists = $this->db->where([
                'category_id'  => $category_id,
                'criteria_id'  => $cr->id,
                'candidate_id' => $candidate_id,
                'judge_id'     => $judge_id,
            ])->get('scores')->row();

            if ($exists) {
                $this->db->where('id', $exists->id)->update('scores', $score_data);
            } else {
                $this->db->insert('scores', $score_data);
            }
        }
        $this->db->trans_complete();

        if ($this->db->trans_status() === false) {
            return $this->output->set_output(json_encode(['success' => false, 'message' => 'Could not save. Please try again.']));
        }

        return $this->output->set_output(json_encode([
            'success'      => true,
            'candidate_id' => $candidate_id,
            'scores'       => $out_scores,
            'total'        => round($total, 2),
        ]));
    }

    public function tabulation()
    {
        // Overall (combined) standings are the admin's view. Judges only see
        // their own per-judge rank on the score-entry page.
        if (!$this->session->userdata('admin_logged_in')) {
            $this->session->set_flashdata('error', 'Tabulation is available to the admin only.');
            redirect('judgedashboard');
        }

        $data['judge'] = $this->judge_info();
        $data['page_title'] = 'Tabulation';
        $data['is_admin'] = $this->session->userdata('admin_logged_in') ? true : false;
        $data['event'] = $this->db->where('is_active', 1)->order_by('id', 'DESC')->get('events')->row();

        $segments = $this->Scoring_model->segments();
        $data['segments'] = $segments;

        // Per-segment results (weighted) + the judges who sign each segment's sheet
        $top10_ids = $this->Scoring_model->advanced_ids('in_top10');
        $top5_ids  = $this->Scoring_model->advanced_ids('in_top5');

        $data['segment_results'] = [];
        $data['segment_judges'] = [];
        foreach ($segments as $seg) {
            $lvl = (int)($seg->round_level ?? 0);
            $filter = $lvl === 1 ? ($top10_ids ?: [-1]) : ($lvl === 2 ? ($top5_ids ?: [-1]) : null);
            $data['segment_results'][$seg->id] = $this->Scoring_model->segment_results($seg, $filter);
            $data['segment_judges'][$seg->id] = $this->Scoring_model->segment_judges($seg->id);
        }

        // Round standings (standalone per round, weighted within the round only —
        // no carry-forward, per the weights defined in admin/categories)
        $data['prelim'] = $this->Scoring_model->standings([0]);                    // Preliminary -> Top 10
        $data['top10_ids'] = $top10_ids;
        $data['top10_standings'] = $this->Scoring_model->standings([1], $top10_ids ?: [-1]); // Prelim Q&A -> Top 5
        $data['top5_ids'] = $top5_ids;
        $data['final_standings'] = $this->Scoring_model->standings([2], $top5_ids ?: [-1]); // Final Round -> winners

        // Grand combined across everything (all candidates) — informational
        // reference only; placements come from the Final Round standings above.
        $data['grand'] = $this->Scoring_model->standings([0, 1, 2]);

        // All judges (for the master signatory block)
        $data['judges'] = $this->db->where('is_active', 1)->order_by('name', 'ASC')->get('judges')->result();

        $this->load->view('tabulation', $data);
    }

    /**
     * Per-judge results: each judge's individual rating of every candidate,
     * broken down by segment (exportable / printable). Admin-only, same as
     * tabulation.
     */
    public function judge_results()
    {
        if (!$this->session->userdata('admin_logged_in')) {
            $this->session->set_flashdata('error', 'Per-judge results are available to the admin only.');
            redirect('judgedashboard');
        }

        $data['judge'] = $this->judge_info();
        $data['page_title'] = 'Per-Judge Results';
        $data['is_admin'] = true;
        $data['event'] = $this->db->where('is_active', 1)->order_by('id', 'DESC')->get('events')->row();

        $segments = $this->Scoring_model->segments();
        $data['segments'] = $segments;

        // Restrict each segment to the candidates active in its round, exactly
        // like the tabulation sheet does.
        $top10_ids = $this->Scoring_model->advanced_ids('in_top10');
        $top5_ids  = $this->Scoring_model->advanced_ids('in_top5');

        $data['matrices'] = [];
        foreach ($segments as $seg) {
            $lvl = (int)($seg->round_level ?? 0);
            $filter = $lvl === 1 ? ($top10_ids ?: [-1]) : ($lvl === 2 ? ($top5_ids ?: [-1]) : null);
            $data['matrices'][$seg->id] = $this->Scoring_model->segment_judge_matrix($seg, $filter);
        }

        $data['judges'] = $this->db->where('is_active', 1)->order_by('name', 'ASC')->get('judges')->result();
        $this->load->view('judge_results', $data);
    }

    /**
     * A judge's own printable score sheet: their individual ratings (per
     * criterion + total) for every candidate, across the segments they are on
     * the panel for. Scoped to the logged-in judge only — judges can export
     * their results without the admin. Admins use the full per-judge view.
     */
    public function my_results()
    {
        $jid = $this->session->userdata('judge_id');
        if (!$jid) {
            // No judging session (e.g. admin viewing) — they have the admin view.
            redirect('judgedashboard');
        }

        $data['judge'] = $this->judge_info();
        $data['page_title'] = 'My Score Sheet';
        $data['event'] = $this->db->where('is_active', 1)->order_by('id', 'DESC')->get('events')->row();

        // Only the segments this judge may score (open panel or assigned).
        $segments = array_values(array_filter($this->Scoring_model->segments(), function ($c) {
            return $this->judge_can_access_category($c->id);
        }));
        $data['segments'] = $segments;

        // Same round scoping as the official sheets.
        $top10_ids = $this->Scoring_model->advanced_ids('in_top10');
        $top5_ids  = $this->Scoring_model->advanced_ids('in_top5');

        $data['sheets'] = [];
        foreach ($segments as $seg) {
            $lvl = (int)($seg->round_level ?? 0);
            $filter = $lvl === 1 ? ($top10_ids ?: [-1]) : ($lvl === 2 ? ($top5_ids ?: [-1]) : null);
            $data['sheets'][$seg->id] = $this->Scoring_model->judge_score_sheet($jid, $seg, $filter);
        }

        $this->load->view('judge_my_results', $data);
    }

    public function logout()
    {
        $this->session->unset_userdata(['judge_id', 'judge_name', 'logged_in']);
        redirect('login/login_page');
    }
}
