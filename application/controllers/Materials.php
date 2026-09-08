<?php
defined('BASEPATH') or exit('No direct script access allowed');

/**
 * Materials controller — manages instructional material uploads.
 *
 * Delegates storage + AI processing to the Node API (Nexam_api library),
 * which handles file extraction, chunking, embedding, and generation.
 * The PHP side owns the UI and the auth/ownership checks.
 */
class Materials extends MY_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->page_title = 'Materials';
        $this->active_nav = 'materials';
        $this->load->model('Subject_model');
        $this->load->library('nexam_api');
    }

    /**
     * List materials for a subject (or all materials if no subject filter).
     */
    public function index()
    {
        $subject_id = $this->input->get('subject_id', true);
        $subject = $subject_id ? $this->Subject_model->get_owned($subject_id, $this->user_id) : null;

        $response = $this->nexam_api->get('materials', $subject_id ? ['subject_id' => $subject_id] : []);
        $materials = ($response['status'] === 200 && isset($response['body']['materials']))
            ? $response['body']['materials']
            : [];

        $data['materials'] = $materials;
        $data['subject_context'] = $subject;
        $data['subject_tab'] = 'materials';
        $data['total'] = count($materials);
        $data['use_datatables'] = true;
        $data['page_css'] = ['materials.css'];
        $data['page_js'] = ['materials.js'];
        $this->render('materials/index', $data);
    }

    /**
     * Upload a new material (file, URL, or text).
     */
    public function upload()
    {
        $subject_id = $this->input->get('subject', true);
        $subject = $subject_id ? $this->Subject_model->get_owned($subject_id, $this->user_id) : null;

        if ($this->input->method() === 'post') {
            $subject_id = $this->input->post('subject_id', true);
            $title = $this->input->post('title', true);
            $url = $this->input->post('url', true);
            $content = $this->input->post('content', true);
            $is_syllabus = $this->input->post('is_syllabus', true);

            // Ownership check
            if (!$this->Subject_model->get_owned($subject_id, $this->user_id)) {
                $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Subject not found.']);
                redirect('materials');
            }

            // Handle file upload via PHP temp, then forward to Node API
            if (!empty($_FILES['file']['name'])) {
                $tmpPath = $_FILES['file']['tmp_name'];
                $originalName = $_FILES['file']['name'];

                $response = $this->nexam_api->upload('materials', $tmpPath, 'file', [
                    'subject_id' => $subject_id,
                    'title' => $title ?: $originalName,
                    'is_syllabus' => $is_syllabus ? 'true' : 'false',
                ]);
            } else if ($url) {
                $response = $this->nexam_api->post('materials', [
                    'subject_id' => $subject_id,
                    'title' => $title ?: $url,
                    'url' => $url,
                    'is_syllabus' => $is_syllabus ? 'true' : 'false',
                ]);
            } else if ($content) {
                $response = $this->nexam_api->post('materials', [
                    'subject_id' => $subject_id,
                    'title' => $title ?: 'Pasted text',
                    'content' => $content,
                    'is_syllabus' => $is_syllabus ? 'true' : 'false',
                ]);
            } else {
                $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Provide a file, URL, or text content.']);
                redirect('materials/upload' . ($subject_id ? '?subject=' . rawurlencode($subject_id) : ''));
            }

            if ($response['status'] === 201) {
                $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'Material uploaded. Processing started.']);
            } else {
                $msg = $response['body']['error'] ?? 'Upload failed.';
                $this->session->set_flashdata('toast', ['type' => 'error', 'message' => $msg]);
            }

            redirect('materials' . ($subject_id ? '?subject_id=' . rawurlencode($subject_id) : ''));
        }

        $data['subjects'] = $this->Subject_model->get_by_user($this->user_id);
        $data['preselect_subject'] = $subject_id;
        $data['page_css'] = ['materials.css'];
        $data['page_js'] = ['materials.js'];
        $this->render('materials/upload', $data);
    }

    /**
     * Delete a material (ownership checked on the Node side).
     */
    public function delete($id)
    {
        if ($this->input->method() !== 'post') {
            show_error('Method Not Allowed', 405);
            return;
        }

        $response = $this->nexam_api->delete('materials/' . $id);

        if ($response['status'] === 200) {
            $this->session->set_flashdata('toast', ['type' => 'delete', 'message' => 'Material deleted.']);
        } else {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Failed to delete material.']);
        }

        redirect('materials');
    }

    /**
     * AJAX: reprocess a failed material.
     */
    public function reprocess($id)
    {
        if (!$this->session->userdata('logged_in')) {
            $this->output->set_status_header(403)->set_content_type('application/json')
                ->set_output(json_encode(['error' => 'Unauthorized']));
            return;
        }
        if ($this->input->method(true) !== 'POST') {
            show_404();
        }

        $response = $this->nexam_api->post('materials/' . $id . '/reprocess');

        $this->output
            ->set_status_header($response['status'])
            ->set_content_type('application/json')
            ->set_output(json_encode($response['body'] ?? ['error' => 'Reprocess failed.']));
    }
}
