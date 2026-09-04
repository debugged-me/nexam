<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Admin extends CI_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->load->library('session');
        $this->load->database();
        $this->load->model('Migration_model');

        // Auto-init tables on first request
        $this->Migration_model->init();

        // Check auth for non-login routes
        $excluded = ['login', 'authenticate'];
        if (!in_array($this->router->fetch_method(), $excluded)) {
            if (!$this->session->userdata('admin_logged_in')) {
                redirect('admin/login');
            }

            // Role-based restriction: tabulators only get the dashboard overview
            // and the rounds/advancement pages here. Everything else (events,
            // categories, criteria, candidates, judges, co-admins) is admin-only.
            // The tabulation results page itself lives in Judgedashboard.
            if ($this->session->userdata('admin_role') === 'tabulator') {
                $tabulator_allowed = ['dashboard', 'rounds', 'rounds_save', 'logout'];
                if (!in_array($this->router->fetch_method(), $tabulator_allowed)) {
                    $this->session->set_flashdata('error', 'You do not have access to that page.');
                    redirect('admin/dashboard');
                }
            }
        }
    }

    public function login()
    {
        if ($this->session->userdata('admin_logged_in')) {
            redirect('admin/dashboard');
        }
        $this->load->view('admin_login');
    }

    public function authenticate()
    {
        $username = $this->input->post('username');
        $password = $this->input->post('password');

        $admin = $this->db->where('username', $username)->where('is_active', 1)->get('admins')->row();

        if ($admin && password_verify($password, $admin->password)) {
            $this->session->set_userdata([
                'admin_id' => $admin->id,
                'admin_name' => $admin->name,
                'admin_role' => $admin->role,
                'admin_logged_in' => true
            ]);
            // Tabulators land on the results page — their primary workspace.
            if ($admin->role === 'tabulator') {
                redirect('judgedashboard/tabulation');
            }
            redirect('admin/dashboard');
        } else {
            $this->session->set_flashdata('error', 'Invalid username or password.');
            redirect('admin/login');
        }
    }

    public function logout()
    {
        $this->session->sess_destroy();
        redirect('admin/login');
    }

    public function dashboard()
    {
        $data['counts'] = [
            'events' => $this->db->count_all('events'),
            'judges' => $this->db->count_all('judges'),
            'candidates' => $this->db->count_all('candidates'),
            'categories' => $this->db->count_all('categories'),
        ];
        $this->load->view('dashboard_admin', $data);
    }

    // =================== EVENTS ===================
    public function events()
    {
        $data['events'] = $this->db->order_by('created_at', 'DESC')->get('events')->result();
        $this->load->view('events_admin', $data);
    }

    public function event_save()
    {
        $id = $this->input->post('id');
        $date = $this->input->post('date');
        $data = [
            'name' => $this->input->post('name'),
            'year' => $date ? date('Y', strtotime($date)) : date('Y'),
            'date' => $date,
            'venue' => '',
            'description' => '',
            'status' => $this->input->post('status'),
            'is_active' => 1
        ];
        if ($id) {
            $this->db->where('id', $id)->update('events', $data);
            $this->session->set_flashdata('success', 'Event updated.');
        } else {
            $this->db->insert('events', $data);
            $this->session->set_flashdata('success', 'Event created.');
        }
        redirect('admin/events');
    }

    public function event_delete($id)
    {
        $this->db->where('id', $id)->delete('events');
        $this->session->set_flashdata('success', 'Event deleted.');
        redirect('admin/events');
    }

    // =================== CATEGORIES ===================
    public function categories()
    {
        $this->load->model('Scoring_model');
        $data['categories'] = $this->db->order_by('round_level', 'ASC')->order_by('order_num', 'ASC')->get('categories')->result();
        $data['judges'] = $this->db->where('is_active', 1)->order_by('name', 'ASC')->get('judges')->result();

        // Map of category_id => [judge_id, ...] for assignment UI
        $data['assigned'] = [];
        foreach ($data['categories'] as $c) {
            $data['assigned'][$c->id] = $this->Scoring_model->assigned_judge_ids($c->id);
        }
        $this->load->view('categories_admin', $data);
    }

    public function category_save()
    {
        $id = $this->input->post('id');
        $data = [
            'name' => $this->input->post('name'),
            'weight' => $this->input->post('weight'),
            'round_level' => (int)$this->input->post('round_level'),
            'segment_date' => $this->input->post('segment_date') ?: null,
            'description' => '',
            'order_num' => (int)$this->input->post('order_num'),
            'is_active' => 1
        ];
        if ($id) {
            $this->db->where('id', $id)->update('categories', $data);
            $this->session->set_flashdata('success', 'Category updated.');
        } else {
            $this->db->insert('categories', $data);
            $id = $this->db->insert_id();
            $this->session->set_flashdata('success', 'Category created.');
        }

        // Save judge panel assignment (checkboxes named judges[])
        $judges = $this->input->post('judges');
        if ($judges !== null) {
            // Clean the posted judge ids (a hidden '' marker is always present).
            $clean = [];
            foreach ((array)$judges as $jid) {
                $jid = trim($jid);
                if ($jid !== '') $clean[] = $jid;
            }

            // Targets: just this category, or every segment in the same round
            // when "apply to all in round" is ticked.
            $target_ids = [(int)$id];
            if ($this->input->post('apply_to_round')) {
                $round_level = (int)$this->input->post('round_level');
                $rows = $this->db->select('id')->where('round_level', $round_level)->get('categories')->result();
                $target_ids = array_map(function ($r) {
                    return (int)$r->id;
                }, $rows);
            }

            foreach ($target_ids as $cid) {
                $this->db->where('category_id', $cid)->delete('category_judges');
                foreach ($clean as $jid) {
                    $this->db->insert('category_judges', ['category_id' => $cid, 'judge_id' => $jid]);
                }
            }
        }
        redirect('admin/categories');
    }

    public function category_delete($id)
    {
        $this->db->where('id', $id)->delete('categories');
        $this->db->where('category_id', $id)->delete('category_judges');
        $this->session->set_flashdata('success', 'Category deleted.');
        redirect('admin/categories');
    }

    /**
     * Lock / unlock a category. While locked, judges can no longer open the
     * score sheet or save scores for it on their dashboard. Toggles the current
     * state so a single button serves both directions.
     */
    public function category_lock_toggle($id)
    {
        $cat = $this->db->where('id', $id)->get('categories')->row();
        if (!$cat) {
            $this->session->set_flashdata('error', 'Category not found.');
            redirect('admin/categories');
        }
        $new = empty($cat->is_locked) ? 1 : 0;
        $this->db->where('id', $id)->update('categories', ['is_locked' => $new]);
        $this->session->set_flashdata('success', $new ? 'Category locked — judges can no longer score it.' : 'Category unlocked — judges can score it again.');
        redirect('admin/categories');
    }

    // =================== ROUNDS / ADVANCEMENT ===================
    public function rounds()
    {
        $this->load->model('Scoring_model');

        // Standalone per-round scoring (no carry-forward): each round is judged
        // on its own segment(s) only, per the weights defined in admin/categories.

        // Top 10 selection: the Preliminary round (main segments) among all candidates
        $data['prelim'] = $this->Scoring_model->standings([0]);

        // Top 5 selection: the Preliminary Q&A round only, among the current Top 10
        $top10_ids = $this->Scoring_model->advanced_ids('in_top10');
        $data['top10_ids'] = $top10_ids;
        $data['top10_standings'] = $this->Scoring_model->standings([1], $top10_ids ?: [-1]);

        // Final standings / winners: the Final Round only, among the current Top 5
        $top5_ids = $this->Scoring_model->advanced_ids('in_top5');
        $data['top5_ids'] = $top5_ids;
        $data['final_standings'] = $this->Scoring_model->standings([2], $top5_ids ?: [-1]);

        $segments = $this->Scoring_model->segments();
        $data['segments'] = $segments;

        // Per-segment 0-100 score sheets (same round scoping as the official
        // tabulation) so the admin can see each segment's score behind the
        // weighted cumulative averages above.
        $data['segment_results'] = [];
        foreach ($segments as $seg) {
            $lvl = (int)($seg->round_level ?? 0);
            $filter = $lvl === 1 ? ($top10_ids ?: [-1]) : ($lvl === 2 ? ($top5_ids ?: [-1]) : null);
            $data['segment_results'][$seg->id] = $this->Scoring_model->segment_results($seg, $filter);
        }

        $data['judges'] = $this->db->where('is_active', 1)->order_by('name', 'ASC')->get('judges')->result();
        $this->load->view('rounds_admin', $data);
    }

    public function rounds_save()
    {
        $flag = $this->input->post('flag'); // 'in_top10' or 'in_top5'
        if (!in_array($flag, ['in_top10', 'in_top5'], true)) {
            redirect('admin/rounds');
        }
        $selected = (array)$this->input->post('candidates'); // candidate ids checked

        // Reset everyone, then set the chosen ones
        $this->db->update('candidates', [$flag => 0]);
        if (!empty($selected)) {
            $this->db->where_in('id', $selected)->update('candidates', [$flag => 1]);
        }

        // If un-advancing from Top 10, also drop them from Top 5 to keep state consistent
        if ($flag === 'in_top10') {
            if (!empty($selected)) {
                $this->db->where_not_in('id', $selected)->update('candidates', ['in_top5' => 0]);
            } else {
                $this->db->update('candidates', ['in_top5' => 0]);
            }
        }

        $label = $flag === 'in_top10' ? 'Top 10' : 'Top 5';
        $this->session->set_flashdata('success', $label . ' advancement saved.');
        redirect('admin/rounds');
    }

    // =================== CRITERIA ===================
    public function criteria()
    {
        $this->db->select('criteria.*, categories.name as category_name, categories.round_level, categories.order_num as category_order');
        $this->db->join('categories', 'categories.id = criteria.category_id');
        $data['criteria'] = $this->db
            ->order_by('categories.round_level', 'ASC')
            ->order_by('categories.order_num', 'ASC')
            ->order_by('criteria.order_num', 'ASC')
            ->get('criteria')->result();
        $data['categories'] = $this->db->where('is_active', 1)
            ->order_by('round_level', 'ASC')->order_by('order_num', 'ASC')->get('categories')->result();
        $this->load->view('criteria_admin', $data);
    }

    public function criteria_save()
    {
        $id = $this->input->post('id');
        $data = [
            'category_id' => $this->input->post('category_id'),
            'name' => $this->input->post('name'),
            'max_score' => $this->input->post('max_score'),
            'description' => '',
            'order_num' => 0,
            'is_active' => 1
        ];
        if ($id) {
            $this->db->where('id', $id)->update('criteria', $data);
            $this->session->set_flashdata('success', 'Criteria updated.');
        } else {
            $this->db->insert('criteria', $data);
            $this->session->set_flashdata('success', 'Criteria created.');
        }
        redirect('admin/criteria');
    }

    public function criteria_delete($id)
    {
        $this->db->where('id', $id)->delete('criteria');
        $this->session->set_flashdata('success', 'Criteria deleted.');
        redirect('admin/criteria');
    }

    // =================== JUDGES ===================
    public function judges()
    {
        $data['judges'] = $this->db->order_by('created_at', 'DESC')->get('judges')->result();
        $data['coadmins'] = $this->db->where_in('role', ['co-admin', 'tabulator'])->order_by('created_at', 'DESC')->get('admins')->result();

        $last = $this->db->select('judge_id')
            ->like('judge_id', 'JUDGE', 'after')
            ->order_by('id', 'DESC')
            ->limit(1)
            ->get('judges')
            ->row();
        if ($last && preg_match('/(\d+)/', $last->judge_id, $m)) {
            $data['next_judge_id'] = 'JUDGE' . str_pad((int)$m[1] + 1, 3, '0', STR_PAD_LEFT);
        } else {
            $data['next_judge_id'] = 'JUDGE001';
        }

        $allIds = $this->db->select('judge_id')->get('judges')->result();
        $data['all_judge_ids'] = array_map(function ($r) {
            return $r->judge_id;
        }, $allIds);

        $this->load->view('judges_admin', $data);
    }

    public function judge_save()
    {
        $id = $this->input->post('id');
        $data = [
            'name' => $this->input->post('name'),
            'identifier' => trim($this->input->post('identifier')) ?: null,
            'email' => $this->input->post('email'),
            'is_active' => 1
        ];
        $password = $this->input->post('password');
        if ($password) {
            $data['password'] = password_hash($password, PASSWORD_DEFAULT);
        }

        if ($id) {
            $this->db->where('id', $id)->update('judges', $data);
            $this->session->set_flashdata('success', 'Judge updated.');
        } else {
            $customId = trim($this->input->post('custom_judge_id') ?: '');
            if ($customId) {
                $exists = $this->db->where('judge_id', $customId)->get('judges')->row();
                if ($exists) {
                    $this->session->set_flashdata('error', 'Judge ID "' . $customId . '" already exists. Please choose another.');
                    redirect('admin/judges');
                }
                $data['judge_id'] = $customId;
            } else {
                $last = $this->db->select('judge_id')
                    ->like('judge_id', 'JUDGE', 'after')
                    ->order_by('id', 'DESC')
                    ->limit(1)
                    ->get('judges')
                    ->row();
                if ($last && preg_match('/(\d+)/', $last->judge_id, $m)) {
                    $data['judge_id'] = 'JUDGE' . str_pad((int)$m[1] + 1, 3, '0', STR_PAD_LEFT);
                } else {
                    $data['judge_id'] = 'JUDGE001';
                }
            }
            if (empty($password)) $data['password'] = password_hash('password', PASSWORD_DEFAULT);
            $this->db->insert('judges', $data);
            $this->session->set_flashdata('success', 'Judge created.');
        }
        redirect('admin/judges');
    }

    public function judge_delete($id)
    {
        $this->db->where('id', $id)->delete('judges');
        $this->session->set_flashdata('success', 'Judge deleted.');
        redirect('admin/judges');
    }

    // =================== CANDIDATES ===================
    public function candidates()
    {
        $data['candidates'] = $this->db->order_by('CAST(candidate_number AS UNSIGNED)', 'ASC', FALSE)->get('candidates')->result();
        $this->load->view('candidates_admin', $data);
    }

    public function candidate_save()
    {
        $id = $this->input->post('id');
        $data = [
            'candidate_number' => $this->input->post('candidate_number'),
            'name' => $this->input->post('name'),
            'barangay' => trim($this->input->post('barangay')),
            'hometown' => '',
            'age' => 0,
            'is_active' => 1
        ];
        if ($id) {
            $this->db->where('id', $id)->update('candidates', $data);
            $this->session->set_flashdata('success', 'Candidate updated.');
        } else {
            $this->db->insert('candidates', $data);
            $this->session->set_flashdata('success', 'Candidate created.');
        }
        redirect('admin/candidates');
    }

    public function candidate_delete($id)
    {
        $this->db->where('id', $id)->delete('candidates');
        $this->session->set_flashdata('success', 'Candidate deleted.');
        redirect('admin/candidates');
    }

    // =================== CO-ADMINS ===================
    public function coadmins()
    {
        $data['coadmins'] = $this->db->where_in('role', ['co-admin', 'tabulator'])->order_by('created_at', 'DESC')->get('admins')->result();
        $this->load->view('coadmins_admin', $data);
    }

    public function coadmin_save()
    {
        $id = $this->input->post('id');

        // Staff accounts can be co-admins (full admin access) or tabulators
        // (results/rounds only). Anything else falls back to co-admin.
        $role = $this->input->post('role');
        if (!in_array($role, ['co-admin', 'tabulator'], true)) {
            $role = 'co-admin';
        }
        $label = $role === 'tabulator' ? 'Tabulator' : 'Co-admin';

        $username = trim($this->input->post('username'));

        // Username must be unique. The index is case-insensitive, so 'ADMIN'
        // collides with 'admin' — check first and show a friendly message instead
        // of letting the duplicate-key DB error surface. On edit, ignore self.
        $dupe = $this->db->where('username', $username);
        if ($id) $this->db->where('id !=', $id);
        if ($this->db->get('admins')->row()) {
            $this->session->set_flashdata('error', 'The username "' . $username . '" is already taken. Please choose another.');
            redirect('admin/judges');
        }

        $data = [
            'username' => $username,
            'name' => $this->input->post('name'),
            'role' => $role,
            'is_active' => 1
        ];
        $password = $this->input->post('password');
        if ($password) {
            $data['password'] = password_hash($password, PASSWORD_DEFAULT);
        }

        if ($id) {
            $this->db->where('id', $id)->update('admins', $data);
            $this->session->set_flashdata('success', $label . ' updated.');
        } else {
            if (empty($password)) $data['password'] = password_hash('password', PASSWORD_DEFAULT);
            $this->db->insert('admins', $data);
            $this->session->set_flashdata('success', $label . ' created.');
        }
        redirect('admin/judges');
    }

    public function coadmin_delete($id)
    {
        $this->db->where('id', $id)->delete('admins');
        $this->session->set_flashdata('success', 'Account deleted.');
        redirect('admin/judges');
    }
}
