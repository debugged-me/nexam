<?php
defined('BASEPATH') or exit('No direct script access allowed');

/**
 * Notifications — the topbar bell.
 *
 * There is no notifications table: every item here is derived on read from the
 * instructor's own content, so the list can never drift out of step with what
 * the pages actually show. Each entry is something the user can act on.
 */
class Notifications extends CI_Controller
{
    /** Most items to hand back in one payload. */
    const MAX_ITEMS = 8;

    public function __construct()
    {
        parent::__construct();
        $this->load->library('session');
        $this->load->helper('url');
        $this->load->database();
        $this->load->model(['Subject_model', 'Question_model', 'Tos_model', 'Exam_model']);
    }

    public function index()
    {
        if (!$this->session->userdata('logged_in')) {
            return $this->_json(403, ['message' => 'Your session has expired. Please sign in again.']);
        }

        $user_id = $this->session->userdata('user_id');
        $items   = $this->_build_items($user_id);

        // Compare against the last-seen count stored in session.
        // Items are "unread" only if the total count has grown since
        // the instructor last opened / dismissed the bell.
        $last_seen = (int) $this->session->userdata('bell_last_seen');
        $unread   = max(0, count($items) - $last_seen);

        return $this->_json(200, [
            'count'  => count($items),
            'unread' => $unread,
            'items'  => $items,
        ]);
    }

    /** POST: mark all current notifications as read. */
    public function mark_read()
    {
        if (!$this->session->userdata('logged_in')) {
            return $this->_json(403, ['message' => 'Unauthorized']);
        }
        if ($this->input->method(true) !== 'POST') {
            show_404();
        }

        $user_id = $this->session->userdata('user_id');
        $items   = $this->_build_items($user_id);

        // Store the count so the bell shows 0 unread until new items appear.
        $this->session->set_userdata('bell_last_seen', count($items));

        return $this->_json(200, ['ok' => true, 'unread' => 0]);
    }

    /** Build the derived alert list from the instructor's own data. */
    private function _build_items($user_id)
    {
        $items = [];

        $q_status = $this->Question_model->status_distribution($user_id);
        $drafts   = isset($q_status['draft']) ? $q_status['draft'] : 0;

        if ($drafts > 0) {
            $items[] = [
                'icon'   => 'file-clock',
                'tone'   => 'amber',
                'title'  => $drafts . ' question' . ($drafts === 1 ? '' : 's') . ' awaiting approval',
                'detail' => 'Draft items are skipped when generating exams.',
                'url'    => site_url('questions'),
            ];
        }

        $unclassified = 0;
        foreach ($this->Question_model->bloom_distribution($user_id) as $level => $count) {
            if ($level === 'unclassified') $unclassified += $count;
        }

        if ($unclassified > 0) {
            $items[] = [
                'icon'   => 'layers',
                'tone'   => 'blue',
                'title'  => $unclassified . ' question' . ($unclassified === 1 ? '' : 's') . ' have no Bloom level',
                'detail' => 'Untagged items cannot be matched to a blueprint.',
                'url'    => site_url('questions'),
            ];
        }

        $e_status   = $this->Exam_model->status_distribution($user_id);
        $exam_draft = isset($e_status['draft']) ? $e_status['draft'] : 0;

        if ($exam_draft > 0) {
            $items[] = [
                'icon'   => 'file-text',
                'tone'   => 'amber',
                'title'  => $exam_draft . ' exam' . ($exam_draft === 1 ? '' : 's') . ' still in draft',
                'detail' => 'Publish when the paper is ready to hand out.',
                'url'    => site_url('exams'),
            ];
        }

        $planned  = $this->Tos_model->total_items_by_user($user_id);
        $approved = isset($q_status['approved']) ? $q_status['approved'] : 0;

        if ($planned > $approved) {
            $short = $planned - $approved;
            $items[] = [
                'icon'   => 'table',
                'tone'   => 'red',
                'title'  => 'Question bank is ' . $short . ' item' . ($short === 1 ? '' : 's') . ' short',
                'detail' => 'Your blueprints plan for ' . $planned . ' items; ' . $approved . ' are approved.',
                'url'    => site_url('tos'),
            ];
        }

        // Subjects that exist but have nothing filed under them yet.
        $counts = $this->Question_model->counts_by_subject($user_id);
        foreach ($this->Subject_model->get_by_user($user_id) as $subject) {
            if (!empty($counts[$subject->id])) continue;

            $items[] = [
                'icon'   => 'book-open',
                'tone'   => 'slate',
                'title'  => $subject->name . ' has no questions yet',
                'detail' => 'Add items so this subject can be used in an exam.',
                'url'    => site_url('questions/create?subject=' . $subject->id),
            ];
        }

        $items = array_slice($items, 0, self::MAX_ITEMS);

        return $items;
    }

    private function _json($status, $payload)
    {
        $this->output
            ->set_status_header($status)
            ->set_content_type('application/json')
            ->set_output(json_encode($payload));
    }
}
