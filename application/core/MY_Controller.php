<?php
defined('BASEPATH') or exit('No direct script access allowed');

/**
 * MY_Controller — base controller for all authenticated pages.
 * Handles auth checks, layout rendering, and shared data.
 */
class MY_Controller extends CI_Controller
{
    /** Page title shown in the browser tab and topbar. */
    protected $page_title = 'nexam';

    /** Active nav item for sidebar highlighting. */
    protected $active_nav = '';

    public function __construct()
    {
        parent::__construct();
        $this->load->library(['session', 'form_validation']);
        $this->load->helper(['url', 'form', 'string']);

        // Enforce auth on every subclass
        if (!$this->session->userdata('logged_in')) {
            $this->session->set_flashdata('toast', ['type' => 'warning', 'message' => 'Please log in to continue.']);
            redirect('login');
        }

        // Make user info available as controller properties
        $this->user_id   = $this->session->userdata('user_id');
        $this->email     = $this->session->userdata('email');
        $this->full_name = $this->session->userdata('full_name');
        $this->role      = $this->session->userdata('role');

        $this->load->database();
    }

    /**
     * Render a page inside the shared dashboard layout.
     *
     * @param string $view   View file name (relative to views/)
     * @param array  $data   Data to pass to the view
     */
    protected function render($view, $data = [])
    {
        $data['page_title']  = $this->page_title;
        $data['active_nav']  = $this->active_nav;
        $data['full_name']   = $this->session->userdata('full_name');
        $data['email']       = $this->session->userdata('email');
        $data['role']        = $this->session->userdata('role');
        $data['user_id']     = $this->session->userdata('user_id');
        $data['csrf_name']   = $this->security->get_csrf_token_name();
        $data['csrf_hash']   = $this->security->get_csrf_hash();

        $this->load->view('partials/head', $data);
        $this->load->view('partials/sidebar', $data);
        $this->load->view('partials/topbar', $data);
        $this->load->view($view, $data);
        $this->load->view('partials/footer', $data);
    }

    /** Generate a UUID v4 string. */
    protected function generate_uuid()
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
