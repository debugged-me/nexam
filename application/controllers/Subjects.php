<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Subjects extends MY_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->page_title = 'Subjects';
        $this->active_nav = 'subjects';
        $this->load->model('Subject_model');
    }

    public function index()
    {
        $this->load->model(['Question_model', 'Tos_model', 'Exam_model']);

        $data['subjects'] = $this->Subject_model->get_by_user($this->user_id);
        $data['total']    = count($data['subjects']);

        // Three grouped counts, not one query per row.
        $data['question_counts'] = $this->Question_model->counts_by_subject($this->user_id);
        $data['tos_counts']      = $this->Tos_model->counts_by_subject($this->user_id);
        $data['exam_counts']     = $this->Exam_model->counts_by_subject($this->user_id);

        $data['use_datatables'] = true;
        $data['page_js'] = ['subjects.js'];

        // Pass subject data for the edit modal (id, name, code, description).
        $data['subjects_json'] = json_encode(
            array_map(function ($s) {
                return [
                    'id'          => $s->id,
                    'name'        => $s->name,
                    'code'        => $s->code ?? '',
                    'description' => $s->description ?? '',
                ];
            }, $data['subjects']),
            JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
        );

        $this->render('subjects/index', $data);
    }

    /** Delete a batch of subjects selected in the list. */
    public function bulk_delete()
    {
        if ($this->input->method() !== 'post') {
            show_404();
            return;
        }

        $ids = $this->input->post('ids', true);
        $ids = is_array($ids) ? array_filter(array_map('strval', $ids), fn($v) => preg_match('/^[0-9a-f\-]{36}$/i', $v)) : [];

        $deleted = $this->Subject_model->delete_many($ids, $this->user_id);

        $this->session->set_flashdata('toast', $deleted > 0
            ? ['type' => 'success', 'message' => $deleted . ' subject' . ($deleted === 1 ? '' : 's') . ' deleted.']
            : ['type' => 'error', 'message' => 'Nothing was deleted.']);

        redirect('subjects');
    }

    public function create()
    {
        $this->page_title = 'New Subject';

        if ($this->input->method() === 'post') {
            $this->form_validation->set_rules('name', 'Subject Name', 'required|trim|max_length[255]');
            $this->form_validation->set_rules('code', 'Code', 'trim|max_length[50]');
            $this->form_validation->set_rules('description', 'Description', 'trim|max_length[5000]');

            if ($this->form_validation->run()) {
                $id = $this->Subject_model->create([
                    'instructor_id' => $this->user_id,
                    'name'          => $this->input->post('name', true),
                    'code'          => $this->input->post('code', true) ?: null,
                    'description'   => $this->input->post('description', true) ?: null,
                ]);
                if ($id) {
                    $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'Subject created successfully.']);
                } else {
                    $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Failed to create subject.']);
                }
                redirect('subjects');
            }
        }

        $this->render('subjects/form');
    }

    /** AJAX: create a subject from the modal. */
    public function store()
    {
        if (!$this->session->userdata('logged_in')) {
            return $this->_json(403, ['message' => 'Unauthorized']);
        }
        if ($this->input->method(true) !== 'POST') {
            return $this->_json(405, ['message' => 'Method not allowed.']);
        }

        $this->form_validation->set_rules('name', 'Subject Name', 'required|trim|max_length[255]');
        $this->form_validation->set_rules('code', 'Code', 'trim|max_length[50]');
        $this->form_validation->set_rules('description', 'Description', 'trim|max_length[5000]');

        if ($this->form_validation->run() === false) {
            return $this->_json(422, ['message' => trim(validation_errors(' ', ' '))]);
        }

        $id = $this->Subject_model->create([
            'instructor_id' => $this->user_id,
            'name'          => $this->input->post('name', true),
            'code'          => $this->input->post('code', true) ?: null,
            'description'   => $this->input->post('description', true) ?: null,
        ]);

        if (!$id) {
            return $this->_json(500, ['message' => 'Failed to create subject.']);
        }

        return $this->_json(200, ['message' => 'Subject created successfully.']);
    }

    private function _json($status, $payload)
    {
        $payload['csrf_name'] = $this->security->get_csrf_token_name();
        $payload['csrf_hash'] = $this->security->get_csrf_hash();

        $this->output
            ->set_status_header($status)
            ->set_content_type('application/json')
            ->set_output(json_encode($payload));
    }

    public function edit($id)
    {
        $subject = $this->Subject_model->get_owned($id, $this->user_id);
        if (!$subject) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Subject not found.']);
            redirect('subjects');
        }

        $this->page_title = 'Edit Subject';

        if ($this->input->method() === 'post') {
            $this->form_validation->set_rules('name', 'Subject Name', 'required|trim|max_length[255]');
            $this->form_validation->set_rules('code', 'Code', 'trim|max_length[50]');
            $this->form_validation->set_rules('description', 'Description', 'trim|max_length[5000]');

            if ($this->form_validation->run()) {
                $this->Subject_model->update($id, [
                    'name'        => $this->input->post('name', true),
                    'code'        => $this->input->post('code', true) ?: null,
                    'description' => $this->input->post('description', true) ?: null,
                ]);
                $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'Subject updated.']);
                redirect('subjects');
            }
        }

        $data['subject'] = $subject;
        $this->render('subjects/form', $data);
    }

    /** AJAX: update a subject from the edit modal. */
    public function update($id)
    {
        if (!$this->session->userdata('logged_in')) {
            return $this->_json(403, ['message' => 'Unauthorized']);
        }
        if ($this->input->method(true) !== 'POST') {
            return $this->_json(405, ['message' => 'Method not allowed.']);
        }

        $subject = $this->Subject_model->get_owned($id, $this->user_id);
        if (!$subject) {
            return $this->_json(404, ['message' => 'Subject not found.']);
        }

        $this->form_validation->set_rules('name', 'Subject Name', 'required|trim|max_length[255]');
        $this->form_validation->set_rules('code', 'Code', 'trim|max_length[50]');
        $this->form_validation->set_rules('description', 'Description', 'trim|max_length[5000]');

        if ($this->form_validation->run() === false) {
            return $this->_json(422, ['message' => trim(validation_errors(' ', ' '))]);
        }

        $this->Subject_model->update($id, [
            'name'        => $this->input->post('name', true),
            'code'        => $this->input->post('code', true) ?: null,
            'description' => $this->input->post('description', true) ?: null,
        ]);

        return $this->_json(200, ['message' => 'Subject updated.']);
    }

    public function delete($id)
    {
        if ($this->input->method() !== 'post') {
            show_error('Method Not Allowed', 405);
            return;
        }

        $subject = $this->Subject_model->get_owned($id, $this->user_id);
        if (!$subject) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Subject not found.']);
            redirect('subjects');
        }

        $this->Subject_model->delete($id);
        $this->session->set_flashdata('toast', ['type' => 'delete', 'message' => 'Subject deleted.']);
        redirect('subjects');
    }

    public function view($id)
    {
        $subject = $this->Subject_model->get_owned($id, $this->user_id);
        if (!$subject) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Subject not found.']);
            redirect('subjects');
        }

        $this->page_title = $subject->name;
        $this->load->model('Question_model');
        $this->load->model('Tos_model');

        $data['subject']        = $subject;
        $data['subject_context'] = $subject;
        $data['subject_tab']     = 'overview';
        $data['questions']      = $this->Question_model->get_by_user($this->user_id, ['subject_id' => $id]);
        $data['tos_list']       = $this->Tos_model->get_by_user($this->user_id, ['subject_id' => $id]);
        $data['question_count'] = count($data['questions']);
        $data['tos_count']      = count($data['tos_list']);
        $this->render('subjects/view', $data);
    }
}
