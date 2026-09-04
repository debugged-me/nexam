<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Home extends CI_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->load->library('session');
        $this->load->helper(['url', 'form']);
    }

    public function index()
    {
        // Default route is handled by 'login' controller; keep this as a fallback.
        redirect('login');
    }

    /** Temporary post-login landing page. Replace with a real Dashboard controller. */
    public function dashboard()
    {
        if (!$this->session->userdata('logged_in')) {
            redirect('login');
        }

        $data['full_name'] = $this->session->userdata('full_name');
        $data['email']     = $this->session->userdata('email');
        $data['role']      = $this->session->userdata('role');
        $this->load->view('dashboard', $data);
    }
}
