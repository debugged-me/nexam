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
        $data['subjects'] = $this->Subject_model->get_by_user($this->user_id);
        $this->render('subjects/index', $data);
    }

    public function create()
    {
        $this->page_title = 'New Subject';

        if ($this->input->method() === 'post') {
            $this->form_validation->set_rules('name', 'Subject Name', 'required|trim|max_length[255]');
            $this->form_validation->set_rules('code', 'Code', 'trim|max_length[50]');
            $this->form_validation->set_rules('description', 'Description', 'trim');

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
            $this->form_validation->set_rules('description', 'Description', 'trim');

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

    public function delete($id)
    {
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

        $this->page_title = htmlspecialchars($subject->name);
        $this->load->model('Question_model');
        $this->load->model('Tos_model');

        $data['subject']        = $subject;
        $data['questions']      = $this->Question_model->get_by_user($this->user_id, ['subject_id' => $id]);
        $data['tos_list']       = $this->db->where('subject_id', $id)->order_by('created_at', 'DESC')->get('tos')->result();
        $data['question_count'] = count($data['questions']);
        $data['tos_count']      = count($data['tos_list']);
        $this->render('subjects/view', $data);
    }
}
