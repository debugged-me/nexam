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
        $this->load->helper(['url', 'form', 'string', 'name']);

        // Enforce auth on every subclass. AJAX callers get a 403 JSON
        // response so the frontend can react cleanly instead of following
        // a 302 redirect to the HTML login page.
        if (!$this->session->userdata('logged_in')) {
            if ($this->input->is_ajax_request()) {
                $this->output
                    ->set_status_header(403)
                    ->set_content_type('application/json')
                    ->set_output(json_encode(['error' => 'Unauthorized', 'message' => 'Please log in to continue.']))
                    ->_display();
                exit;
            }
            $this->session->set_flashdata('toast', ['type' => 'warning', 'message' => 'Please log in to continue.']);
            redirect('login');
        }

        // Make user info available as controller properties
        $this->user_id   = $this->session->userdata('user_id');
        $this->email     = $this->session->userdata('email');
        $this->full_name = $this->session->userdata('full_name');
        $this->role      = $this->session->userdata('role');

        $this->load->database();

        // Cache the avatar path in the session so the shell can render the
        // photo without hitting the database on every page load.
        if ($this->session->userdata('avatar_path') === null) {
            $this->load->model('User_model');
            $user = $this->User_model->find_by_id($this->user_id);
            $this->session->set_userdata('avatar_path', $user ? $user->avatar_path : '');
        }
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
        $data['avatar_path'] = $this->session->userdata('avatar_path');
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

    /* ------------------------------------------------------------------
       Pagination helper
       ------------------------------------------------------------------ */

    /**
     * Build pagination data from the current request.
     *
     * Reads `page` from the query string (1-based), clamps it to valid
     * bounds, and returns the offset + a render-ready array for the
     * pagination partial. Existing query params (e.g. filters) are
     * preserved in every page link.
     *
     * @param int    $total     Total row count.
     * @param int    $per_page  Rows per page (default 10).
     * @return array  ['page','per_page','offset','total_pages','total','from','to','links','has_prev','has_next','prev_url','next_url']
     */
    protected function paginate($total, $per_page = 10)
    {
        $per_page  = max(1, (int) $per_page);
        $total     = max(0, (int) $total);
        $total_pages = $total > 0 ? (int) ceil($total / $per_page) : 1;

        $page = (int) $this->input->get('page', true);
        if ($page < 1) $page = 1;
        if ($page > $total_pages) $page = $total_pages;

        $offset = ($page - 1) * $per_page;

        $from = $total > 0 ? $offset + 1 : 0;
        $to   = min($offset + $per_page, $total);

        // Preserve existing query params (filters etc.) in pagination links
        $query = $this->input->get(NULL, true);
        if (isset($query['page'])) unset($query['page']);

        $build_url = function ($p) use ($query) {
            $query['page'] = $p;
            return current_url() . '?' . http_build_query($query);
        };

        // Build a window of page numbers around the current page
        $links = [];
        $window = 2; // pages either side of current
        $start = max(1, $page - $window);
        $end   = min($total_pages, $page + $window);

        for ($i = $start; $i <= $end; $i++) {
            $links[] = [
                'page'      => $i,
                'url'       => $build_url($i),
                'is_active' => $i === $page,
            ];
        }

        return [
            'page'        => $page,
            'per_page'    => $per_page,
            'offset'      => $offset,
            'total'       => $total,
            'total_pages' => $total_pages,
            'from'        => $from,
            'to'          => $to,
            'links'       => $links,
            'has_prev'    => $page > 1,
            'has_next'    => $page < $total_pages,
            'prev_url'    => $page > 1 ? $build_url($page - 1) : null,
            'next_url'    => $page < $total_pages ? $build_url($page + 1) : null,
            'show_first'  => $start > 1,
            'show_last'   => $end < $total_pages,
            'first_url'   => $build_url(1),
            'last_url'    => $build_url($total_pages),
        ];
    }
}
