<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Login extends CI_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->load->library('session');
        $this->load->helper('url');
        $this->load->database();
        $this->load->model('User_model');
    }

    /**
     * Default route redirects here. Show the login form, or bounce to
     * a dashboard if the user is already authenticated.
     */
    public function index()
    {
        if ($this->session->userdata('logged_in')) {
            redirect('dashboard');
        }

        $this->load->view('login');
    }

    /** Validate credentials posted from the login form. */
    public function authenticate()
    {
        $email    = trim($this->input->post('email', true));
        $password = $this->input->post('password', true);

        if ($email === '' || $password === '') {
            $this->session->set_flashdata('error', 'Please enter both email and password.');
            redirect('login');
        }

        $user = $this->User_model->verify_credentials($email, $password);

        if (!$user) {
            $this->session->set_flashdata('error', 'Invalid email or password.');
            redirect('login');
        }

        $this->session->set_userdata([
            'user_id'    => $user->id,
            'email'      => $user->email,
            'full_name'  => $user->full_name,
            'role'       => $user->role,
            'logged_in'  => true,
        ]);

        redirect('dashboard');
    }

    /** Destroy the session and return to the login page. */
    public function logout()
    {
        $this->session->sess_destroy();
        redirect('login');
    }
}
