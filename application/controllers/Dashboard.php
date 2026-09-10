<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Dashboard extends MY_Controller
{
    /** Canonical Bloom taxonomy order, mirrors Questions controller. */
    private $bloom_levels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

    /** Days of history handed to the client (2x the widest 90-day range, for comparisons). */
    const HISTORY_DAYS = 180;

    public function __construct()
    {
        parent::__construct();
        $this->page_title = 'Dashboard';
        $this->active_nav = 'dashboard';
        $this->load->model('Subject_model');
        $this->load->model('Question_model');
        $this->load->model('Tos_model');
        $this->load->model('Exam_model');
    }

    public function index()
    {
        $user_id = $this->session->userdata('user_id');

        /* ---- Totals ---- */
        $data['stats'] = [
            'subjects'  => $this->Subject_model->count_by_user($user_id),
            'materials' => $this->db->where('created_by', $user_id)->count_all_results('materials'),
            'questions' => $this->Question_model->count_by_user($user_id),
            'tos'       => $this->Tos_model->count_by_user($user_id),
            'exams'     => $this->Exam_model->count_by_user($user_id),
        ];

        /* ---- 30-day window vs. the 30 days before it ---- */
        $now       = date('Y-m-d H:i:s');
        $win_start = date('Y-m-d 00:00:00', strtotime('-29 days'));
        $prev_start = date('Y-m-d 00:00:00', strtotime('-59 days'));

        $data['deltas'] = [
            'subjects'  => $this->_delta(
                $this->Subject_model->count_created_between($user_id, $win_start, $now),
                $this->Subject_model->count_created_between($user_id, $prev_start, $win_start)
            ),
            'questions' => $this->_delta(
                $this->Question_model->count_created_between($user_id, $win_start, $now),
                $this->Question_model->count_created_between($user_id, $prev_start, $win_start)
            ),
            'tos'       => $this->_delta(
                $this->Tos_model->count_created_between($user_id, $win_start, $now),
                $this->Tos_model->count_created_between($user_id, $prev_start, $win_start)
            ),
            'exams'     => $this->_delta(
                $this->Exam_model->count_created_between($user_id, $win_start, $now),
                $this->Exam_model->count_created_between($user_id, $prev_start, $win_start)
            ),
        ];

        /* ---- Daily activity series (questions + exams) ---- */
        $data['series'] = $this->_build_series($user_id);

        /* ---- Bloom coverage ---- */
        $bloom_raw = $this->Question_model->bloom_distribution($user_id);
        $bloom = [];
        foreach ($this->bloom_levels as $level) {
            $bloom[$level] = isset($bloom_raw[$level]) ? $bloom_raw[$level] : 0;
        }
        $unclassified = 0;
        foreach ($bloom_raw as $key => $count) {
            if (!in_array($key, $this->bloom_levels, true)) $unclassified += $count;
        }
        $data['bloom'] = $bloom;
        $data['bloom_unclassified'] = $unclassified;
        $data['bloom_covered'] = count(array_filter($bloom));

        /* ---- Question bank readiness ---- */
        $q_status = $this->Question_model->status_distribution($user_id);
        $approved = isset($q_status['active']) ? $q_status['active'] : 0;
        $draft    = isset($q_status['draft']) ? $q_status['draft'] : 0;
        $other    = max(0, $data['stats']['questions'] - $approved - $draft);

        $data['bank'] = [
            'approved' => $approved,
            'draft'    => $draft,
            'other'    => $other,
            'total'    => $data['stats']['questions'],
            'ready_pct' => $data['stats']['questions'] > 0
                ? (int) round($approved / $data['stats']['questions'] * 100)
                : 0,
        ];

        /* ---- Exam pipeline ---- */
        $e_status = $this->Exam_model->status_distribution($user_id);
        $data['exam_status'] = [
            'published' => isset($e_status['published']) ? $e_status['published'] : 0,
            'draft'     => isset($e_status['draft']) ? $e_status['draft'] : 0,
        ];

        /* ---- Blueprint capacity: planned items vs. questions on hand ---- */
        $planned = $this->Tos_model->total_items_by_user($user_id);
        $data['blueprint'] = [
            'planned'  => $planned,
            'on_hand'  => $data['stats']['questions'],
            'fill_pct' => $planned > 0
                ? min(100, (int) round($data['stats']['questions'] / $planned * 100))
                : 0,
        ];

        /* ---- Recent activity ---- */
        $subject_counts = $this->Question_model->counts_by_subject($user_id);
        $recent_subjects = $this->Subject_model->get_recent_by_user($user_id, 5);
        foreach ($recent_subjects as $s) {
            $s->question_count = isset($subject_counts[$s->id]) ? $subject_counts[$s->id] : 0;
        }

        $data['recent_subjects'] = $recent_subjects;
        $data['recent_exams']    = $this->Exam_model->get_recent_with_counts($user_id, 5);

        $data['greeting'] = $this->_greeting();

        $data['page_css'] = ['dashboard.css'];
        $data['page_js']  = ['dashboard.js'];

        $this->render('dashboard/index', $data);
    }

    /**
     * Build a day-by-day activity series covering HISTORY_DAYS, oldest first.
     * The view hands the whole window to the client, which slices it per range.
     */
    private function _build_series($user_id)
    {
        $days  = self::HISTORY_DAYS;
        $from  = date('Y-m-d 00:00:00', strtotime('-' . ($days - 1) . ' days'));
        $to    = date('Y-m-d 00:00:00', strtotime('+1 day'));

        $questions = $this->Question_model->daily_counts($user_id, $from, $to);
        $exams     = $this->Exam_model->daily_counts($user_id, $from, $to);

        $series = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $key = date('Y-m-d', strtotime('-' . $i . ' days'));
            $series[] = [
                'd' => $key,
                'l' => date('M j', strtotime($key)),
                'q' => isset($questions[$key]) ? $questions[$key] : 0,
                'e' => isset($exams[$key]) ? $exams[$key] : 0,
            ];
        }

        return $series;
    }

    /** Percentage change between two period counts, plus the raw numbers. */
    private function _delta($current, $previous)
    {
        if ($previous > 0) {
            $pct = (int) round(($current - $previous) / $previous * 100);
            $dir = $pct > 0 ? 'up' : ($pct < 0 ? 'down' : 'flat');
        } elseif ($current > 0) {
            $pct = 100;
            $dir = 'up';
        } else {
            $pct = 0;
            $dir = 'flat';
        }

        return ['current' => $current, 'previous' => $previous, 'pct' => abs($pct), 'dir' => $dir];
    }

    /** Time-of-day greeting in the app timezone. */
    private function _greeting()
    {
        $hour = (int) date('G');
        if ($hour < 12) return 'Good morning';
        if ($hour < 18) return 'Good afternoon';
        return 'Good evening';
    }
}
