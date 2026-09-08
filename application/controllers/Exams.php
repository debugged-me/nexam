<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Exams extends MY_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->page_title = 'Exams';
        $this->active_nav = 'exams';
        $this->load->model('Exam_model');
        $this->load->model('Subject_model');
        $this->load->model('Tos_model');
        $this->load->model('Question_model');
    }

    /** List exams owned by the logged-in user. */
    public function index()
    {
        $subject_id = $this->input->get('subject_id', true);
        $subject = $subject_id ? $this->Subject_model->get_owned($subject_id, $this->user_id) : null;
        $filters = ['subject_id' => $subject ? $subject->id : null];
        $data['exams'] = $this->Exam_model->get_with_counts($this->user_id, $filters);
        $data['subject_context'] = $subject;
        $data['subject_tab'] = 'exams';
        $data['total'] = count($data['exams']);
        $data['use_datatables'] = true;
        $this->render('exams/index', $data);
    }

    /** Delete a batch of exams selected in the list. */
    public function bulk_delete()
    {
        if ($this->input->method() !== 'post') {
            show_404();
            return;
        }

        $ids = $this->input->post('ids', true);
        $ids = is_array($ids) ? array_filter(array_map('strval', $ids), fn($v) => preg_match('/^[0-9a-f\-]{36}$/i', $v)) : [];

        $deleted = $this->Exam_model->delete_many($ids, $this->user_id);

        $this->session->set_flashdata('toast', $deleted > 0
            ? ['type' => 'success', 'message' => $deleted . ' exam' . ($deleted === 1 ? '' : 's') . ' deleted.']
            : ['type' => 'error', 'message' => 'Nothing was deleted.']);

        redirect('exams');
    }

    /** Create an exam. Supports ?tos=UUID or ?subject=UUID pre-selection. */
    public function create()
    {
        $this->page_title = 'New Exam';

        $subjects = $this->Subject_model->get_by_user($this->user_id);
        if (empty($subjects)) {
            $this->session->set_flashdata('toast', ['type' => 'info', 'message' => 'Create a subject before creating an exam.']);
            redirect('subjects/create');
        }

        $tos_id = $this->input->get('tos', true);
        $preselect_subject = $this->input->get('subject', true);
        if ($preselect_subject && !$this->Subject_model->get_owned($preselect_subject, $this->user_id)) {
            $preselect_subject = null;
        }
        $tos = null;
        if ($tos_id) {
            $tos = $this->Tos_model->get_owned($tos_id, $this->user_id);
            if (!$tos) {
                $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'TOS blueprint not found.']);
                redirect('exams');
            }
        }

        if ($this->input->method() === 'post') {
            $this->form_validation->set_rules('title', 'Title', 'required|trim|max_length[255]');
            $this->form_validation->set_rules('subject_id', 'Subject', 'required|trim|callback_owned_subject');
            $this->form_validation->set_rules('tos_id', 'TOS blueprint', 'trim|callback_valid_tos_selection');
            $this->form_validation->set_rules('format', 'Format', 'required|trim|in_list[print,digital]');
            $this->form_validation->set_rules('set_count', 'Exam Sets', 'trim|integer|in_list[1,2]');
            $this->form_validation->set_rules('duration_minutes', 'Duration', 'trim|integer|greater_than_equal_to[0]|less_than_equal_to[1000]');
            $this->form_validation->set_rules('instructions', 'Instructions', 'trim|max_length[5000]');

            if ($this->form_validation->run()) {
                $this->db->trans_start();
                $id = $this->Exam_model->create([
                    'subject_id'        => $this->input->post('subject_id', true),
                    'title'             => $this->input->post('title', true),
                    'format'            => $this->input->post('format', true),
                    'set_count'         => (int) $this->input->post('set_count', true) ?: 1,
                    'duration_minutes'  => $this->input->post('duration_minutes', true) ?: null,
                    'instructions'      => $this->input->post('instructions', true) ?: null,
                    'status'            => 'draft',
                    'created_by'        => $this->user_id,
                ]);

                if ($id) {
                    // Auto-select questions from a TOS blueprint if provided
                    $submitted_tos = $this->input->post('tos_id', true);
                    if ($submitted_tos) {
                        $this->_generate_from_tos($submitted_tos, $id, $this->input->post('subject_id', true));
                    }
                }
                $this->db->trans_complete();

                if ($id && $this->db->trans_status()) {
                    $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'Exam created successfully.']);
                    redirect('exams/view/' . $id);
                } else {
                    $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Failed to create exam.']);
                }
            }
        }

        $data['subjects'] = $subjects;
        $data['tos']      = $tos;
        $data['preselect_subject'] = $preselect_subject;
        $data['tos_list'] = $this->Tos_model->get_by_user($this->user_id);
        if ($tos) {
            $data['bloom_weights'] = json_decode($tos->bloom_weights, true);
        }
        $this->render('exams/form', $data);
    }

    /** View exam details + list of questions. */
    public function view($id)
    {
        $exam = $this->Exam_model->get_owned($id, $this->user_id);
        if (!$exam) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Exam not found.']);
            redirect('exams');
        }

        $this->page_title = $exam->title;

        $data['exam']      = $exam;
        $data['subject']   = $this->Subject_model->get_owned($exam->subject_id, $this->user_id);
        $data['subject_context'] = $data['subject'];
        $data['subject_tab'] = 'exams';
        $data['questions'] = $this->Exam_model->get_questions($exam->id);
        $data['page_css'] = ['exams.css'];
        $data['page_js'] = ['exams.js'];
        $this->render('exams/view', $data);
    }

    /** Edit exam metadata. Publishing is intentionally handled separately. */
    public function edit($id)
    {
        $exam = $this->Exam_model->get_owned($id, $this->user_id);
        if (!$exam) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Exam not found.']);
            redirect('exams');
        }

        $this->page_title = 'Edit Exam';

        if ($this->input->method() === 'post') {
            $this->form_validation->set_rules('title', 'Title', 'required|trim|max_length[255]');
            $this->form_validation->set_rules('subject_id', 'Subject', 'required|trim|callback_owned_subject');
            $this->form_validation->set_rules('format', 'Format', 'required|trim|in_list[print,digital]');
            $this->form_validation->set_rules('set_count', 'Exam Sets', 'trim|integer|in_list[1,2]');
            $this->form_validation->set_rules('duration_minutes', 'Duration', 'trim|integer|greater_than_equal_to[0]|less_than_equal_to[1000]');
            $this->form_validation->set_rules('instructions', 'Instructions', 'trim|max_length[5000]');

            if ($this->form_validation->run()) {
                $this->Exam_model->update($id, [
                    'subject_id'        => $this->input->post('subject_id', true),
                    'title'             => $this->input->post('title', true),
                    'format'            => $this->input->post('format', true),
                    'set_count'         => (int) $this->input->post('set_count', true) ?: 1,
                    'duration_minutes'  => $this->input->post('duration_minutes', true) ?: null,
                    'instructions'      => $this->input->post('instructions', true) ?: null,
                ]);
                $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'Exam updated.']);
                redirect('exams/view/' . $id);
            }
        }

        $data['exam']     = $exam;
        $data['subjects'] = $this->Subject_model->get_by_user($this->user_id);
        $this->render('exams/form', $data);
    }

    /** Delete an exam. */
    public function delete($id)
    {
        if ($this->input->method() !== 'post') {
            show_error('Method Not Allowed', 405);
            return;
        }

        $exam = $this->Exam_model->get_owned($id, $this->user_id);
        if (!$exam) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Exam not found.']);
            redirect('exams');
        }

        $this->Exam_model->delete($id);
        $this->session->set_flashdata('toast', ['type' => 'delete', 'message' => 'Exam deleted.']);
        redirect('exams');
    }

    /** Publish a draft exam. */
    public function publish($id)
    {
        if ($this->input->method() !== 'post') {
            show_error('Method Not Allowed', 405);
            return;
        }

        $exam = $this->Exam_model->get_owned($id, $this->user_id);
        if (!$exam) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Exam not found.']);
            redirect('exams');
        }

        $this->Exam_model->update($id, ['status' => 'published']);
        $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'Exam published.']);
        redirect('exams/view/' . $id);
    }

    /**
     * AJAX: generate Set A/Set B PDFs, answer keys, and TOS report via Node API.
     */
    public function generate_pdfs()
    {
        if (!$this->session->userdata('logged_in')) {
            $this->output->set_status_header(403)->set_content_type('application/json')
                ->set_output(json_encode(['error' => 'Unauthorized']));
            return;
        }
        if ($this->input->method(true) !== 'POST') {
            show_404();
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $exam_id = $input['exam_id'] ?? null;
        if (!$exam_id) {
            $this->output->set_status_header(400)->set_content_type('application/json')
                ->set_output(json_encode(['error' => 'exam_id is required.']));
            return;
        }

        // Ownership check
        $exam = $this->Exam_model->get_owned($exam_id, $this->user_id);
        if (!$exam) {
            $this->output->set_status_header(404)->set_content_type('application/json')
                ->set_output(json_encode(['error' => 'Exam not found.']));
            return;
        }

        $this->load->library('nexam_api');
        $response = $this->nexam_api->post('exams/' . $exam_id . '/generate-sets');

        $this->output
            ->set_status_header($response['status'])
            ->set_content_type('application/json')
            ->set_output(json_encode($response['body'] ?? ['error' => 'Generation failed.']));
    }

    /**
     * Download a generated PDF (exam, answer key, or TOS report).
     * Streams the file from the Node API to the browser.
     */
    public function download($exam_id, $type)
    {
        if (!$this->session->userdata('logged_in')) {
            show_404();
            return;
        }

        // Ownership check
        $exam = $this->Exam_model->get_owned($exam_id, $this->user_id);
        if (!$exam) {
            show_404();
            return;
        }

        $set = $this->input->get('set', true);

        // Build the Node API URL
        $url = "http://localhost:3000/api/exams/{$exam_id}/download/{$type}";
        if ($set) $url .= '?set=' . rawurlencode($set);

        // Generate a JWT for the Node API
        $this->load->library('nexam_api');
        $token = $this->_get_node_token();

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'Accept: application/pdf',
            ],
            CURLOPT_TIMEOUT => 60,
        ]);

        $content = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error || $status !== 200) {
            show_error('Failed to download file.', 404);
            return;
        }

        $filename = $type === 'tos-report' ? "tos_report_{$exam_id}.pdf" : "{$type}_{$exam_id}_set{$set}.pdf";
        $this->output
            ->set_content_type('application/pdf')
            ->set_header('Content-Disposition: attachment; filename="' . $filename . '"')
            ->set_header('Content-Length: ' . strlen($content))
            ->set_output($content);
    }

    /** Generate a JWT for the Node API using the session user. */
    private function _get_node_token()
    {
        $secret = getenv('JWT_SECRET') ?: 'change-me-in-production';
        $header = rtrim(strtr(base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT'])), '+/', '-_'), '=');
        $payload = rtrim(strtr(base64_encode(json_encode([
            'id' => $this->user_id,
            'email' => $this->email,
            'role' => $this->role,
            'iat' => time(),
            'exp' => time() + 3600,
        ])), '+/', '-_'), '=');
        $sig = rtrim(strtr(base64_encode(hash_hmac('sha256', "$header.$payload", $secret, true)), '+/', '-_'), '=');
        return "$header.$payload.$sig";
    }

    /**
     * Export exam questions as GIFT (Moodle) or XML (Canvas).
     * Streams the export from the Node API to the browser.
     */
    public function export($exam_id, $format)
    {
        if (!$this->session->userdata('logged_in')) {
            show_404();
            return;
        }

        // Ownership check
        $exam = $this->Exam_model->get_owned($exam_id, $this->user_id);
        if (!$exam) {
            show_404();
            return;
        }

        $format = strtolower($format);
        if (!in_array($format, ['gift', 'xml'], true)) {
            show_404();
            return;
        }

        $token = $this->_get_node_token();
        $url = "http://localhost:3000/api/exams/{$exam_id}/export/{$format}";

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'Accept: ' . ($format === 'gift' ? 'text/plain' : 'application/xml'),
            ],
            CURLOPT_TIMEOUT => 30,
        ]);

        $content = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error || $status !== 200) {
            show_error('Export failed.', 500);
            return;
        }

        $ext = $format === 'gift' ? 'gift' : 'xml';
        $ctype = $format === 'gift' ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8';
        $filename = preg_replace('/[^a-z0-9]+/i', '_', $exam->title) . '.' . $ext;

        $this->output
            ->set_content_type($ctype)
            ->set_header('Content-Disposition: attachment; filename="' . $filename . '"')
            ->set_header('Content-Length: ' . strlen($content))
            ->set_output($content);
    }

    /**
     * Auto-select questions from a TOS blueprint and add them to the exam.
     * Decodes bloom_weights JSON, calculates count per bloom level, and
     * randomly selects that many active questions matching subject + bloom.
     *
     * @param string $tos_id
     * @param string $exam_id
     * @param string $subject_id
     */
    private function _generate_from_tos($tos_id, $exam_id, $subject_id)
    {
        $tos = $this->Tos_model->get_owned($tos_id, $this->user_id);
        if (!$tos || $tos->subject_id !== $subject_id) {
            return;
        }

        $allocation = $this->_allocation_from_tos($tos);

        $sort_order = 1;
        foreach ($allocation as $bloom => $count) {
            if ($count <= 0) {
                continue;
            }
            $questions = $this->Question_model->get_by_subject_bloom($subject_id, $bloom, $count, $this->user_id);
            foreach ($questions as $q) {
                $this->Exam_model->add_question($exam_id, $q->id, $sort_order);
                $sort_order++;
            }
        }
    }

    /** Ensure a submitted subject belongs to the current instructor. */
    public function owned_subject($subject_id)
    {
        if ($this->input->method(true) !== 'POST') { show_404(); }
        if ($subject_id && $this->Subject_model->get_owned($subject_id, $this->user_id)) {
            return true;
        }

        $this->form_validation->set_message('owned_subject', 'Select a subject from your workspace.');
        return false;
    }

    /** Validate that a selected TOS matches the subject and has enough active questions. */
    public function valid_tos_selection($tos_id)
    {
        if ($this->input->method(true) !== 'POST') { show_404(); }
        if (!$tos_id) {
            return true;
        }

        $tos = $this->Tos_model->get_owned($tos_id, $this->user_id);
        $subject_id = $this->input->post('subject_id', true);
        if (!$tos || $tos->subject_id !== $subject_id) {
            $this->form_validation->set_message('valid_tos_selection', 'The TOS blueprint must belong to the selected subject.');
            return false;
        }

        $weights = json_decode($tos->bloom_weights, true);
        if (!is_array($weights) || array_sum($weights) !== 100) {
            $this->form_validation->set_message('valid_tos_selection', 'The selected TOS has an invalid Bloom distribution. Update it so the weights total 100%.');
            return false;
        }

        $shortages = [];
        foreach ($this->_allocation_from_tos($tos) as $bloom => $needed) {
            $available = $this->Question_model->count_active_by_subject_bloom($subject_id, $bloom, $this->user_id);
            if ($available < $needed) {
                $shortages[] = ucfirst($bloom) . ': need ' . $needed . ', available ' . $available;
            }
        }

        if ($shortages) {
            $this->form_validation->set_message('valid_tos_selection', 'Not enough active questions for this blueprint (' . implode('; ', $shortages) . ').');
            return false;
        }

        return true;
    }

    /** Convert percentage weights into an exact item count using largest remainders. */
    private function _allocation_from_tos($tos)
    {
        $weights = json_decode($tos->bloom_weights, true);
        if (!is_array($weights) || empty($weights) || (int) $tos->total_items < 1) {
            return [];
        }

        $total = (int) $tos->total_items;
        $allocation = [];
        $remainders = [];
        $allocated = 0;
        foreach ($weights as $bloom => $pct) {
            $exact = ((float) $pct / 100) * $total;
            $whole = (int) floor($exact);
            $allocation[$bloom] = $whole;
            $remainders[$bloom] = $exact - $whole;
            $allocated += $whole;
        }

        arsort($remainders);
        foreach (array_keys($remainders) as $bloom) {
            if ($allocated >= $total) {
                break;
            }
            $allocation[$bloom]++;
            $allocated++;
        }

        return $allocation;
    }
}
