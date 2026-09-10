<?php
defined('BASEPATH') or exit('No direct script access allowed');

/**
 * Analytics controller — performance dashboards from OMR scan results.
 *
 * Delegates computation to the Node API (Nexam_api library) which queries
 * the scan_results and scan_answers tables. The PHP side owns the UI.
 */
class Analytics extends MY_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->page_title = 'Analytics';
        $this->active_nav = 'analytics';
        $this->load->library('nexam_api');
    }

    /** Overview dashboard — instructor-level summary. */
    public function index()
    {
        $response = $this->nexam_api->get('analytics/overview');
        $data['overview'] = $response['body']['overview'] ?? [];
        $data['recent_scans'] = array_map(fn($s) => (object) $s, $response['body']['recentScans'] ?? []);
        $data['exam_averages'] = array_map(fn($e) => (object) $e, $response['body']['examAverages'] ?? []);
        $data['page_css'] = ['analytics.css'];
        $data['page_js'] = ['analytics.js'];
        $this->render('analytics/index', $data);
    }

    /** Exam-level analytics — class average, score distribution, student list. */
    public function exam($exam_id)
    {
        $response = $this->nexam_api->get("analytics/exam/$exam_id");
        if ($response['status'] !== 200) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Exam analytics not found.']);
            redirect('analytics');
            return;
        }

        $data['exam'] = (object) ($response['body']['exam'] ?? []);
        $data['stats'] = (object) ($response['body']['stats'] ?? []);
        $data['distribution'] = array_map(fn($d) => (object) $d, $response['body']['distribution'] ?? []);
        $data['students'] = array_map(fn($s) => (object) $s, $response['body']['students'] ?? []);
        $data['page_css'] = ['analytics.css'];
        $data['page_js'] = ['analytics.js'];
        $this->render('analytics/exam', $data);
    }

    /** Item-level analysis — response distributions per question. */
    public function items($exam_id)
    {
        $response = $this->nexam_api->get("analytics/exam/$exam_id/items");
        if ($response['status'] !== 200) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Item analysis not found.']);
            redirect('analytics');
            return;
        }

        $data['items'] = json_decode(json_encode($response['body']['items'] ?? []));
        $data['exam_id'] = $exam_id;
        $data['page_css'] = ['analytics.css'];
        $data['page_js'] = ['analytics.js'];
        $this->render('analytics/items', $data);
    }

    /** Individual student performance across exams. */
    public function student($student_id)
    {
        $response = $this->nexam_api->get("analytics/student/$student_id");
        if ($response['status'] !== 200) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Student not found.']);
            redirect('analytics');
            return;
        }

        $data['student'] = (object) ($response['body']['student'] ?? []);
        $data['scans'] = array_map(fn($s) => (object) $s, $response['body']['scans'] ?? []);
        $data['stats'] = (object) ($response['body']['stats'] ?? []);
        $data['page_css'] = ['analytics.css'];
        $data['page_js'] = ['analytics.js'];
        $this->render('analytics/student', $data);
    }

    /** AI component evaluation metrics. */
    public function ai_eval()
    {
        $response = $this->nexam_api->get('ai-eval/summary');
        $data['generation'] = $response['body']['generation'] ?? [];
        $data['similarity'] = $response['body']['similarity'] ?? [];
        $data['extraction'] = $response['body']['extraction'] ?? [];
        $data['providers'] = $response['body']['providers'] ?? [];
        $data['bloom_distribution'] = $response['body']['bloomDistribution'] ?? [];
        $data['type_distribution'] = $response['body']['typeDistribution'] ?? [];
        $data['confusion_matrix'] = $response['body']['confusionMatrix'] ?? [];
        $data['page_css'] = ['analytics.css'];
        $data['page_js'] = ['analytics.js'];
        $this->render('analytics/ai_eval', $data);
    }
}
