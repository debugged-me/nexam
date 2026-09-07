<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Questions extends MY_Controller
{
    /** Allowed Bloom levels (whitelist). */
    private $bloom_levels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

    /** Allowed question types (whitelist). */
    private $question_types = ['mcq', 'true_false', 'identification', 'essay'];

    /** Allowed statuses (whitelist). */
    private $statuses = ['draft', 'active'];

    public function __construct()
    {
        parent::__construct();
        $this->page_title = 'Questions';
        $this->active_nav = 'questions';
        $this->load->model('Subject_model');
        $this->load->model('Question_model');
    }

    /**
     * List questions for the logged-in user with optional filters.
     */
    public function index()
    {
        $filters = [
            'subject_id' => $this->input->get('subject_id', true),
            'bloom'      => $this->input->get('bloom', true),
            'type'       => $this->input->get('type', true),
        ];

        // Validate filter values against whitelists to avoid arbitrary input
        if (!in_array($filters['bloom'], $this->bloom_levels, true)) {
            $filters['bloom'] = null;
        }
        if (!in_array($filters['type'], $this->question_types, true)) {
            $filters['type'] = null;
        }

        $data['subjects'] = $this->Subject_model->get_by_user($this->user_id);

        // Build a subject lookup map so the view can show subject names
        $subject_map = [];
        foreach ($data['subjects'] as $s) {
            $subject_map[$s->id] = $s->name;
            if (!empty($filters['subject_id']) && (string) $filters['subject_id'] === (string) $s->id) {
                $data['subject_context'] = $s;
            }
        }
        if (empty($data['subject_context'])) {
            $filters['subject_id'] = null;
        }

        $data['filters'] = $filters;

        // Bloom and type are filtered in the browser by the grid facets, so the
        // whole (subject-scoped) set is loaded and stays available for the user
        // to widen the filter again without a round trip.
        $data['questions'] = $this->Question_model->get_by_user(
            $this->user_id,
            ['subject_id' => $filters['subject_id']]
        );
        $data['subject_tab'] = 'questions';
        $data['subject_map'] = $subject_map;

        $data['total']      = count($data['questions']);
        $data['use_datatables'] = true;

        // Whitelists for the client-side modal forms
        $data['bloom_levels']   = $this->bloom_levels;
        $data['question_types'] = $this->question_types;
        $data['statuses']       = $this->statuses;

        $data['page_css'] = ['questions.css'];
        $data['page_js']  = ['questions.js'];

        $this->render('questions/index', $data);
    }

    /** Delete a batch of questions selected in the list. */
    public function bulk_delete()
    {
        if ($this->input->method() !== 'post') {
            show_404();
            return;
        }

        $ids = $this->input->post('ids', true);
        $ids = is_array($ids) ? array_filter(array_map('strval', $ids), fn($v) => preg_match('/^[0-9a-f\-]{36}$/i', $v)) : [];

        $deleted = $this->Question_model->delete_many($ids, $this->user_id);

        $this->session->set_flashdata('toast', $deleted > 0
            ? ['type' => 'success', 'message' => $deleted . ' question' . ($deleted === 1 ? '' : 's') . ' deleted.']
            : ['type' => 'error', 'message' => 'Nothing was deleted.']);

        redirect('questions');
    }

    /**
     * AJAX endpoint: create a question from a modal form submission.
     * Returns JSON with a fresh CSRF hash so the dialog can be reused.
     */
    public function store()
    {
        if (!$this->_guard()) return;

        $subjects = $this->Subject_model->get_by_user($this->user_id);
        if (empty($subjects)) {
            return $this->_json(422, ['message' => 'Create a subject first before adding questions.']);
        }

        $this->_set_validation_rules();

        if ($this->form_validation->run() === false) {
            return $this->_json(422, ['message' => trim(validation_errors(' ', ' '))]);
        }

        $data = $this->_collect_post();
        $data['created_by'] = $this->user_id;

        $id = $this->Question_model->create($data);
        if (!$id) {
            return $this->_json(500, ['message' => 'Failed to create question.']);
        }

        return $this->_json(200, ['message' => 'Question created successfully.']);
    }

    /* ------------------------------------------------------------------
       AJAX helpers
       ------------------------------------------------------------------ */

    /** Require an authenticated POST — writes the error JSON on failure. */
    private function _guard()
    {
        if (!$this->session->userdata('logged_in')) {
            $this->_json(403, ['message' => 'Your session has expired. Please sign in again.']);
            return false;
        }

        if ($this->input->method(true) !== 'POST') {
            $this->_json(405, ['message' => 'Method not allowed.']);
            return false;
        }

        return true;
    }

    /** Emit a JSON response carrying a fresh CSRF hash for the next request. */
    private function _json($status, $payload)
    {
        $payload['csrf_name'] = $this->security->get_csrf_token_name();
        $payload['csrf_hash'] = $this->security->get_csrf_hash();

        $this->output
            ->set_status_header($status)
            ->set_content_type('application/json')
            ->set_output(json_encode($payload));
    }

    /**
     * Show the create form / handle the POST to create a new question.
     * Supports ?subject=UUID to pre-select a subject.
     */
    public function create()
    {
        $this->page_title = 'New Question';

        $subjects = $this->Subject_model->get_by_user($this->user_id);

        if (empty($subjects)) {
            $this->session->set_flashdata('toast', ['type' => 'warning', 'message' => 'Create a subject first before adding questions.']);
            redirect('subjects');
        }

        if ($this->input->method() === 'post') {
            $this->_set_validation_rules();

            if ($this->form_validation->run()) {
                $data = $this->_collect_post();
                $data['created_by'] = $this->user_id;

                $id = $this->Question_model->create($data);
                if ($id) {
                    $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'Question created successfully.']);
                } else {
                    $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Failed to create question.']);
                }
                redirect('questions');
            }
        }

        $data['subjects']         = $subjects;
        $data['bloom_levels']     = $this->bloom_levels;
        $data['question_types']   = $this->question_types;
        $data['statuses']         = $this->statuses;
        $data['preselect_subject'] = $this->input->get('subject', true);
        $data['page_css']           = ['questions.css'];
        $data['page_js']            = ['questions.js'];
        $this->render('questions/form', $data);
    }

    /**
     * Show the edit form / handle the POST to update a question.
     * Uses get_owned() for IDOR protection.
     */
    public function edit($id)
    {
        $question = $this->Question_model->get_owned($id, $this->user_id);
        if (!$question) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Question not found.']);
            redirect('questions');
        }

        $this->page_title = 'Edit Question';

        if ($this->input->method() === 'post') {
            $this->_set_validation_rules();

            if ($this->form_validation->run()) {
                $data = $this->_collect_post();
                $this->Question_model->update($id, $data);
                $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'Question updated.']);
                redirect('questions');
            }
        }

        $data['question']       = $question;
        // Decode JSON options back to one-per-line text for the form
        if ($question->options) {
            $opts = json_decode($question->options, true);
            $question->options = is_array($opts) ? implode("\n", $opts) : '';
        }
        $data['subjects']       = $this->Subject_model->get_by_user($this->user_id);
        $data['bloom_levels']   = $this->bloom_levels;
        $data['question_types'] = $this->question_types;
        $data['statuses']       = $this->statuses;
        $data['page_css']       = ['questions.css'];
        $data['page_js']        = ['questions.js'];
        $this->render('questions/form', $data);
    }

    /**
     * Delete a question after verifying ownership (IDOR protection).
     */
    public function delete($id)
    {
        if ($this->input->method() !== 'post') {
            show_error('Method Not Allowed', 405);
            return;
        }

        $question = $this->Question_model->get_owned($id, $this->user_id);
        if (!$question) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Question not found.']);
            redirect('questions');
        }

        $this->Question_model->delete($id);
        $this->session->set_flashdata('toast', ['type' => 'delete', 'message' => 'Question deleted.']);
        redirect('questions');
    }

    /**
     * Set the shared form_validation rules for create/edit.
     */
    private function _set_validation_rules()
    {
        $this->form_validation->set_rules('subject_id', 'Subject', 'required|trim|callback_owned_subject');
        $this->form_validation->set_rules('topic', 'Topic', 'trim|max_length[255]');
        $this->form_validation->set_rules('bloom', 'Bloom Level', 'trim|in_list[remember,understand,apply,analyze,evaluate,create]');
        $this->form_validation->set_rules('type', 'Question Type', 'required|trim|in_list[mcq,true_false,identification,essay]');
        $this->form_validation->set_rules('stem', 'Question Stem', 'required|trim|max_length[10000]');
        $this->form_validation->set_rules('options', 'Options', 'trim|callback_valid_question_content');
        $this->form_validation->set_rules('answer', 'Answer', 'trim|max_length[10000]|callback_valid_answer_for_type');
        $this->form_validation->set_rules('explanation', 'Explanation', 'trim|max_length[10000]');
        $this->form_validation->set_rules('status', 'Status', 'trim|in_list[draft,active]');
    }

    /**
     * Collect and sanitize POST data into the array format for the model.
     */
    private function _collect_post()
    {
        $bloom = $this->input->post('bloom', true);
        $status = $this->input->post('status', true);

        // Options come as one-per-line text; store as JSON array (DB has json_valid CHECK)
        $options_raw = $this->input->post('options', true);
        $options = null;
        if ($options_raw) {
            $lines = array_filter(array_map('trim', explode("\n", $options_raw)), 'strlen');
            $options = json_encode(array_values($lines));
        }

        return [
            'subject_id'  => $this->input->post('subject_id', true),
            'topic'       => $this->input->post('topic', true) ?: null,
            'bloom'       => in_array($bloom, $this->bloom_levels, true) ? $bloom : null,
            'type'        => $this->input->post('type', true),
            'stem'        => $this->input->post('stem', true),
            'options'     => $options,
            'answer'      => $this->input->post('answer', true) ?: null,
            'explanation' => $this->input->post('explanation', true) ?: null,
            'status'      => in_array($status, $this->statuses, true) ? $status : 'draft',
        ];
    }

    /** Ensure multiple-choice questions have usable options and a matching answer. */
    public function valid_question_content($options_raw)
    {
        if ($this->input->method(true) !== 'POST') { show_404(); }
        if ($this->input->post('type', true) !== 'mcq') {
            return true;
        }

        $lines = array_values(array_filter(array_map('trim', preg_split('/\r?\n/', (string) $options_raw)), 'strlen'));
        $answer = trim((string) $this->input->post('answer', true));

        if (count($lines) < 2) {
            $this->form_validation->set_message('valid_question_content', 'Multiple-choice questions need at least two answer options.');
            return false;
        }

        if ($answer === '' || !in_array($answer, $lines, true)) {
            $this->form_validation->set_message('valid_question_content', 'Select a correct answer from the available options.');
            return false;
        }

        return true;
    }

    /** Keep fixed-choice answer types internally consistent. */
    public function valid_answer_for_type($answer)
    {
        if ($this->input->method(true) !== 'POST') { show_404(); }
        $type = $this->input->post('type', true);
        if ($type === 'true_false' && !in_array($answer, ['True', 'False'], true)) {
            $this->form_validation->set_message('valid_answer_for_type', 'Select either True or False as the answer.');
            return false;
        }

        return true;
    }

    /** Form-validation callback: subject must belong to the signed-in user. */
    public function owned_subject($subject_id)
    {
        if ($this->input->method(true) !== 'POST') { show_404(); }
        if ($this->Subject_model->get_owned($subject_id, $this->user_id)) return true;
        $this->form_validation->set_message('owned_subject', 'Select a subject from your workspace.');
        return false;
    }
}
