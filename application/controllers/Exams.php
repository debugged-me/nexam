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
        $per_page = 10;
        $total = $this->Exam_model->count_by_user($this->user_id);
        $pagination = $this->paginate($total, $per_page);

        $data['exams']      = $this->Exam_model->get_with_counts($this->user_id, $per_page, $pagination['offset']);
        $data['pagination'] = $pagination;
        $data['total']      = $total;
        $this->render('exams/index', $data);
    }

    /** Create an exam. Supports ?tos=UUID to pre-select from a TOS blueprint. */
    public function create()
    {
        $this->page_title = 'New Exam';

        $tos_id = $this->input->get('tos');
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
            $this->form_validation->set_rules('subject_id', 'Subject', 'required|trim');
            $this->form_validation->set_rules('format', 'Format', 'required|trim|in_list[print,digital]');
            $this->form_validation->set_rules('duration_minutes', 'Duration', 'trim|integer|less_than_equal_to[1000]');
            $this->form_validation->set_rules('instructions', 'Instructions', 'trim');

            if ($this->form_validation->run()) {
                $id = $this->Exam_model->create([
                    'subject_id'        => $this->input->post('subject_id', true),
                    'title'             => $this->input->post('title', true),
                    'format'            => $this->input->post('format', true),
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
                    $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'Exam created successfully.']);
                    redirect('exams/view/' . $id);
                } else {
                    $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Failed to create exam.']);
                }
            }
        }

        $data['subjects'] = $this->Subject_model->get_by_user($this->user_id);
        $data['tos']      = $tos;
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

        $this->page_title = htmlspecialchars($exam->title);

        $data['exam']      = $exam;
        $data['subject']   = $this->Subject_model->get_by_id($exam->subject_id);
        $data['questions'] = $this->Exam_model->get_questions($exam->id);
        $this->render('exams/view', $data);
    }

    /** Edit exam title, format, duration, instructions, status. */
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
            $this->form_validation->set_rules('subject_id', 'Subject', 'required|trim');
            $this->form_validation->set_rules('format', 'Format', 'required|trim|in_list[print,digital]');
            $this->form_validation->set_rules('duration_minutes', 'Duration', 'trim|integer|less_than_equal_to[1000]');
            $this->form_validation->set_rules('instructions', 'Instructions', 'trim');
            $this->form_validation->set_rules('status', 'Status', 'required|trim|in_list[draft,published]');

            if ($this->form_validation->run()) {
                $this->Exam_model->update($id, [
                    'subject_id'        => $this->input->post('subject_id', true),
                    'title'             => $this->input->post('title', true),
                    'format'            => $this->input->post('format', true),
                    'duration_minutes'  => $this->input->post('duration_minutes', true) ?: null,
                    'instructions'      => $this->input->post('instructions', true) ?: null,
                    'status'            => $this->input->post('status', true),
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
        if (!$tos) {
            return;
        }

        $weights = json_decode($tos->bloom_weights, true);
        if (!is_array($weights) || empty($weights)) {
            return;
        }

        $sort_order = 1;
        foreach ($weights as $bloom => $pct) {
            $count = (int) round(($pct / 100) * $tos->total_items);
            if ($count <= 0) {
                continue;
            }
            $questions = $this->Question_model->get_by_subject_bloom($subject_id, $bloom, $count);
            foreach ($questions as $q) {
                $this->Exam_model->add_question($exam_id, $q->id, $sort_order);
                $sort_order++;
            }
        }
    }
}
