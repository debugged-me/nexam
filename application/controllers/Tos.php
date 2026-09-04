<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Tos extends MY_Controller
{
    /** Default Bloom weights used for new TOS. */
    private $default_bloom = [
        'remember'   => 15,
        'understand' => 20,
        'apply'      => 20,
        'analyze'    => 20,
        'evaluate'   => 15,
        'create'     => 10,
    ];

    public function __construct()
    {
        parent::__construct();
        $this->page_title = 'TOS Builder';
        $this->active_nav = 'tos';
        $this->load->model('Tos_model');
        $this->load->model('Subject_model');
    }

    /** List all TOS owned by the logged-in user. */
    public function index()
    {
        $per_page = 10;
        $total = $this->Tos_model->count_by_user($this->user_id);
        $pagination = $this->paginate($total, $per_page);

        $data['tos_list']   = $this->Tos_model->get_by_user($this->user_id, $per_page, $pagination['offset']);
        $data['pagination'] = $pagination;
        $data['total']      = $total;
        $this->render('tos/index', $data);
    }

    /** Create a new TOS. Supports ?subject=UUID to pre-select a subject. */
    public function create()
    {
        $this->page_title = 'New TOS';

        $subjects = $this->Subject_model->get_by_user($this->user_id);
        $preselect = $this->input->get('subject', true);

        if ($this->input->method() === 'post') {
            $this->form_validation->set_rules('title', 'Title', 'required|trim|max_length[255]');
            $this->form_validation->set_rules('subject_id', 'Subject', 'required|trim');
            $this->form_validation->set_rules('total_items', 'Total Items', 'required|integer|greater_than[0]');
            $this->form_validation->set_rules('remember', 'Remember', 'integer|greater_than_equal_to[0]|less_than_equal_to[100]');
            $this->form_validation->set_rules('understand', 'Understand', 'integer|greater_than_equal_to[0]|less_than_equal_to[100]');
            $this->form_validation->set_rules('apply', 'Apply', 'integer|greater_than_equal_to[0]|less_than_equal_to[100]');
            $this->form_validation->set_rules('analyze', 'Analyze', 'integer|greater_than_equal_to[0]|less_than_equal_to[100]');
            $this->form_validation->set_rules('evaluate', 'Evaluate', 'integer|greater_than_equal_to[0]|less_than_equal_to[100]');
            $this->form_validation->set_rules('create', 'Create', 'integer|greater_than_equal_to[0]|less_than_equal_to[100]');

            if ($this->form_validation->run()) {
                $bloom = $this->_collect_bloom();

                $id = $this->Tos_model->create([
                    'subject_id'   => $this->input->post('subject_id', true),
                    'title'        => $this->input->post('title', true),
                    'total_items'  => (int) $this->input->post('total_items', true),
                    'bloom_weights' => json_encode($bloom),
                ]);

                if ($id) {
                    $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'TOS created successfully.']);
                    redirect('tos/view/' . $id);
                } else {
                    $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Failed to create TOS.']);
                    redirect('tos');
                }
            }
        }

        $data['subjects']      = $subjects;
        $data['preselect']      = $preselect;
        $data['bloom_weights']  = $this->default_bloom;
        $this->render('tos/form', $data);
    }

    /** Edit an existing TOS (ownership-checked). */
    public function edit($id)
    {
        $tos = $this->Tos_model->get_owned($id, $this->user_id);
        if (!$tos) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'TOS not found.']);
            redirect('tos');
        }

        $this->page_title = 'Edit TOS';

        if ($this->input->method() === 'post') {
            $this->form_validation->set_rules('title', 'Title', 'required|trim|max_length[255]');
            $this->form_validation->set_rules('subject_id', 'Subject', 'required|trim');
            $this->form_validation->set_rules('total_items', 'Total Items', 'required|integer|greater_than[0]');
            $this->form_validation->set_rules('remember', 'Remember', 'integer|greater_than_equal_to[0]|less_than_equal_to[100]');
            $this->form_validation->set_rules('understand', 'Understand', 'integer|greater_than_equal_to[0]|less_than_equal_to[100]');
            $this->form_validation->set_rules('apply', 'Apply', 'integer|greater_than_equal_to[0]|less_than_equal_to[100]');
            $this->form_validation->set_rules('analyze', 'Analyze', 'integer|greater_than_equal_to[0]|less_than_equal_to[100]');
            $this->form_validation->set_rules('evaluate', 'Evaluate', 'integer|greater_than_equal_to[0]|less_than_equal_to[100]');
            $this->form_validation->set_rules('create', 'Create', 'integer|greater_than_equal_to[0]|less_than_equal_to[100]');

            if ($this->form_validation->run()) {
                $bloom = $this->_collect_bloom();

                $this->Tos_model->update($id, [
                    'subject_id'   => $this->input->post('subject_id', true),
                    'title'        => $this->input->post('title', true),
                    'total_items'  => (int) $this->input->post('total_items', true),
                    'bloom_weights' => json_encode($bloom),
                ]);

                $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'TOS updated.']);
                redirect('tos/view/' . $id);
            }
        }

        $data['tos']           = $tos;
        $data['subjects']      = $this->Subject_model->get_by_user($this->user_id);
        $data['bloom_weights'] = $this->_decode_bloom($tos->bloom_weights);
        $this->render('tos/form', $data);
    }

    /** View a TOS with its topics. */
    public function view($id)
    {
        $tos = $this->Tos_model->get_owned($id, $this->user_id);
        if (!$tos) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'TOS not found.']);
            redirect('tos');
        }

        $this->page_title = htmlspecialchars($tos->title);

        $subject = $this->Subject_model->get_by_id($tos->subject_id);

        $data['tos']           = $tos;
        $data['subject']       = $subject;
        $data['bloom_weights'] = $this->_decode_bloom($tos->bloom_weights);
        $data['topics']        = $this->Tos_model->get_topics($id);
        $this->render('tos/view', $data);
    }

    /** Delete a TOS. */
    public function delete($id)
    {
        $tos = $this->Tos_model->get_owned($id, $this->user_id);
        if (!$tos) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'TOS not found.']);
            redirect('tos');
        }

        $this->Tos_model->delete($id);
        $this->session->set_flashdata('toast', ['type' => 'delete', 'message' => 'TOS deleted.']);
        redirect('tos');
    }

    /** POST handler: add a topic to a TOS. */
    public function add_topic($tos_id)
    {
        $tos = $this->Tos_model->get_owned($tos_id, $this->user_id);
        if (!$tos) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'TOS not found.']);
            redirect('tos');
        }

        if ($this->input->method() === 'post') {
            $this->form_validation->set_rules('title', 'Topic Title', 'required|trim|max_length[255]');
            $this->form_validation->set_rules('instructional_hours', 'Instructional Hours', 'integer|greater_than_equal_to[0]');

            if ($this->form_validation->run()) {
                // Determine next sort_order
                $topics = $this->Tos_model->get_topics($tos_id);
                $max_order = 0;
                foreach ($topics as $t) {
                    if ($t->sort_order > $max_order) {
                        $max_order = $t->sort_order;
                    }
                }

                $this->Tos_model->add_topic([
                    'tos_id'             => $tos_id,
                    'title'              => $this->input->post('title', true),
                    'instructional_hours' => (int) $this->input->post('instructional_hours', true) ?: 0,
                    'sort_order'         => $max_order + 1,
                ]);
                $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'Topic added.']);
            } else {
                $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Please provide a topic title.']);
            }
        }

        redirect('tos/view/' . $tos_id);
    }

    /** Delete a topic from a TOS. */
    public function delete_topic($tos_id, $topic_id)
    {
        $tos = $this->Tos_model->get_owned($tos_id, $this->user_id);
        if (!$tos) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'TOS not found.']);
            redirect('tos');
        }

        $this->Tos_model->delete_topic($topic_id);
        $this->session->set_flashdata('toast', ['type' => 'delete', 'message' => 'Topic removed.']);
        redirect('tos/view/' . $tos_id);
    }

    /**
     * Collect the 6 Bloom weight values from POST input.
     *
     * @return array
     */
    private function _collect_bloom()
    {
        return [
            'remember'   => (int) $this->input->post('remember', true),
            'understand' => (int) $this->input->post('understand', true),
            'apply'      => (int) $this->input->post('apply', true),
            'analyze'    => (int) $this->input->post('analyze', true),
            'evaluate'   => (int) $this->input->post('evaluate', true),
            'create'     => (int) $this->input->post('create', true),
        ];
    }

    /**
     * Decode the bloom_weights JSON string, falling back to defaults.
     *
     * @param string|null $json
     * @return array
     */
    private function _decode_bloom($json)
    {
        $decoded = $json ? json_decode($json, true) : null;
        if (!is_array($decoded)) {
            return $this->default_bloom;
        }

        // Ensure all 6 keys exist
        $result = [];
        foreach (array_keys($this->default_bloom) as $key) {
            $result[$key] = isset($decoded[$key]) ? (int) $decoded[$key] : 0;
        }
        return $result;
    }
}
