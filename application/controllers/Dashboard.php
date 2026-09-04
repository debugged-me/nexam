<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Dashboard extends MY_Controller
{
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

        $data['stats'] = [
            'subjects'  => $this->Subject_model->count_by_user($user_id),
            'questions' => $this->Question_model->count_by_user($user_id),
            'tos'       => $this->Tos_model->count_by_user($user_id),
            'exams'     => $this->Exam_model->count_by_user($user_id),
        ];

        $data['recent_subjects'] = $this->Subject_model->get_recent_by_user($user_id, 5);
        $data['recent_exams']    = $this->Exam_model->get_recent_by_user($user_id, 5);

        $this->render('dashboard/index', $data);
    }
}
