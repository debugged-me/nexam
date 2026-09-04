<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Login extends CI_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->load->library('session');
        $this->load->database();
        $this->load->model('Judge_model');
        $this->load->model('Scoring_model');
    }

    public function index()
    {
        $board = $this->Scoring_model->current_leaderboard();
        $data = [
            'stats'      => $this->Scoring_model->landing_stats(),
            'event'      => $this->db->where('is_active', 1)->order_by('id', 'DESC')->get('events')->row(),
            'board'      => $board,
            'board_top'  => array_slice($board['rows'], 0, 5), // preview on the landing page
        ];
        $this->load->view('landing', $data);
    }

    /** Public live leaderboard page. */
    public function leaderboard()
    {
        $data = [
            'event' => $this->db->where('is_active', 1)->order_by('id', 'DESC')->get('events')->row(),
            'board' => $this->Scoring_model->current_leaderboard(),
        ];
        $this->load->view('leaderboard', $data);
    }

    /** JSON feed that powers the live auto-refresh on the leaderboard. */
    public function leaderboard_data()
    {
        $this->output
            ->set_content_type('application/json')
            ->set_output(json_encode($this->Scoring_model->current_leaderboard()));
    }

    public function login_page()
    {
        $this->load->view('login');
    }

    public function authenticate()
    {
        $judge_id = $this->input->post('username');
        $password = $this->input->post('password');

        $judge = $this->Judge_model->validate_credentials($judge_id, $password);

        if ($judge) {
            $this->session->set_userdata([
                'judge_id' => $judge->judge_id,
                'judge_name' => $judge->name,
                'logged_in' => true
            ]);
            redirect('dashboard');
        } else {
            $this->session->set_flashdata('error', 'Invalid Judge ID or Password.');
            redirect('login/login_page');
        }
    }

    public function forgot()
    {
        $this->load->view('forgot_password');
    }

    public function reset_password()
    {
        $judge_id = $this->input->post('judge_id');
        $judge = $this->Judge_model->get_by_judge_id($judge_id);

        if (!$judge) {
            $this->session->set_flashdata('error', 'Judge ID not found.');
            redirect('login/forgot');
        }

        $temp_password = bin2hex(random_bytes(4)); // 8-char hex string
        $this->Judge_model->set_temp_password($judge_id, $temp_password);

        // If email exists, you can send email here
        // For now, show the temporary password directly
        $this->session->set_flashdata('success', 'Temporary password generated. Please check below.');
        $this->session->set_flashdata('temp_password', $temp_password);
        redirect('login/forgot_result');
    }

    public function forgot_result()
    {
        $this->load->view('forgot_result');
    }
}
