<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Login extends CI_Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->load->library(['session', 'email', 'form_validation']);
        $this->load->helper(['url', 'form', 'string']);
        $this->load->database();
        $this->load->model('User_model');
    }

    /**
     * Show the login form, or bounce to dashboard if already authenticated.
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
            $this->session->set_flashdata('toast', ['type' => 'warning', 'message' => 'Please enter both email and password.']);
            redirect('login');
        }

        $user = $this->User_model->verify_credentials($email, $password);

        if (!$user) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Invalid email or password.']);
            redirect('login');
        }

        // Block login until email is verified
        if ((int) $user->email_verified !== 1) {
            $this->session->set_userdata([
                'pending_otp_user_id' => $user->id,
                'pending_otp_email'   => $user->email,
            ]);
            $this->session->set_flashdata('toast', ['type' => 'warning', 'message' => 'Please verify your email before logging in.']);
            redirect('verify');
        }

        $this->session->set_userdata([
            'user_id'   => $user->id,
            'email'     => $user->email,
            'full_name' => $user->full_name,
            'role'      => $user->role,
            'logged_in' => true,
        ]);

        redirect('dashboard');
    }

    /** Show the registration form. */
    public function register()
    {
        if ($this->session->userdata('logged_in')) {
            redirect('dashboard');
        }

        $this->load->view('register');
    }

    /** Process registration form submission. */
    public function register_submit()
    {
        $this->form_validation->set_rules('first_name', 'First Name', 'required|trim|max_length[100]');
        $this->form_validation->set_rules('middle_name', 'Middle Name', 'trim|max_length[100]');
        $this->form_validation->set_rules('last_name', 'Last Name', 'required|trim|max_length[100]');
        $this->form_validation->set_rules('name_ext', 'Extension', 'trim|max_length[20]');
        $this->form_validation->set_rules('email', 'Email', 'required|trim|valid_email|max_length[255]');
        $this->form_validation->set_rules('password', 'Password', 'required|min_length[8]');
        $this->form_validation->set_rules('confirm_password', 'Confirm Password', 'required|matches[password]');

        if ($this->form_validation->run() === false) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => validation_errors(' ', ' ')]);
            redirect('register');
        }

        $email = trim($this->input->post('email', true));

        if ($this->User_model->find_by_email($email)) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'An account with that email already exists.']);
            redirect('register');
        }

        $first_name  = trim($this->input->post('first_name', true));
        $middle_name = trim($this->input->post('middle_name', true));
        $last_name   = trim($this->input->post('last_name', true));
        $name_ext    = trim($this->input->post('name_ext', true));
        $password    = $this->input->post('password', true);

        $user_id = $this->User_model->create_user($email, $password, $first_name, $middle_name, $last_name, $name_ext);

        if (!$user_id) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Failed to create account. Please try again.']);
            redirect('register');
        }

        // Generate and send OTP
        $full_name = $this->User_model->compose_full_name($first_name, $middle_name, $last_name, $name_ext);
        $otp  = $this->User_model->generate_otp($user_id);
        $sent = $this->_send_otp_email($email, $full_name, $otp);

        $this->session->set_userdata([
            'pending_otp_user_id' => $user_id,
            'pending_otp_email'   => $email,
        ]);

        // The account exists either way; only the delivery can fail, and the
        // verify page offers a resend, so say what actually happened.
        $this->session->set_flashdata('toast', $sent
            ? ['type' => 'success', 'message' => 'Account created! Check your email for the verification code.']
            : ['type' => 'warning', 'message' => 'Account created, but we could not send the verification email. Use "Resend code" below, or contact your administrator.']);

        redirect('verify');
    }

    /** Show OTP verification page. */
    public function verify()
    {
        if (!$this->session->userdata('pending_otp_user_id')) {
            redirect('login');
        }

        $data['email'] = $this->session->userdata('pending_otp_email');
        $this->load->view('verify', $data);
    }

    /** Process OTP verification. */
    public function verify_submit()
    {
        $user_id = $this->session->userdata('pending_otp_user_id');
        if (!$user_id) {
            redirect('login');
        }

        $code = trim($this->input->post('code', true));

        if ($code === '') {
            $this->session->set_flashdata('toast', ['type' => 'warning', 'message' => 'Please enter the verification code.']);
            redirect('verify');
        }

        $valid = $this->User_model->verify_otp($user_id, $code);

        if (!$valid) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Invalid or expired verification code.']);
            redirect('verify');
        }

        $this->User_model->mark_email_verified($user_id);

        $this->session->unset_userdata(['pending_otp_user_id', 'pending_otp_email']);
        $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'Email verified! You can now log in.']);
        redirect('login');
    }

    /** Resend OTP code. */
    public function resend_otp()
    {
        $user_id = $this->session->userdata('pending_otp_user_id');
        if (!$user_id) {
            redirect('login');
        }

        $email = $this->session->userdata('pending_otp_email');
        $user  = $this->User_model->find_by_id($user_id);

        $otp  = $this->User_model->generate_otp($user_id);
        $sent = $this->_send_otp_email($email, $user->full_name, $otp);

        $this->session->set_flashdata('toast', $sent
            ? ['type' => 'info', 'message' => 'A new verification code has been sent.']
            : ['type' => 'error', 'message' => 'We could not send the email right now. Please try again shortly.']);

        redirect('verify');
    }

    /** Show forgot password form. */
    public function forgot()
    {
        $this->load->view('forgot');
    }

    /** Process forgot password — send OTP to reset. */
    public function forgot_submit()
    {
        $email = trim($this->input->post('email', true));

        if ($email === '') {
            $this->session->set_flashdata('toast', ['type' => 'warning', 'message' => 'Please enter your email address.']);
            redirect('forgot');
        }

        $user = $this->User_model->find_by_email($email);

        // Always show the same message to prevent email enumeration.
        if ($user) {
            $otp  = $this->User_model->generate_otp($user->id);
            $sent = $this->_send_otp_email($user->email, $user->full_name, $otp, true);

            // A delivery failure is about our mail server, not about whether
            // the account exists, so reporting it leaks nothing.
            if (!$sent) {
                $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'We could not send the email right now. Please try again shortly.']);
                redirect('forgot');
            }

            $this->session->set_userdata([
                'reset_user_id' => $user->id,
                'reset_email'   => $user->email,
            ]);

            $this->session->set_flashdata('toast', ['type' => 'info', 'message' => 'If an account exists for that email, a reset code has been sent.']);
            redirect('reset');
        }

        // No account found — redirect back to forgot so the message survives.
        $this->session->set_flashdata('toast', ['type' => 'info', 'message' => 'If an account exists for that email, a reset code has been sent.']);
        redirect('forgot');
    }

    /** Show reset password (OTP entry + new password) form. */
    public function reset()
    {
        if (!$this->session->userdata('reset_user_id')) {
            $this->session->set_flashdata('toast', ['type' => 'warning', 'message' => 'Your reset session has expired. Please request a new code.']);
            redirect('forgot');
        }

        $data['email'] = $this->session->userdata('reset_email');
        $this->load->view('reset', $data);
    }

    /** Process password reset with OTP. */
    public function reset_submit()
    {
        $user_id = $this->session->userdata('reset_user_id');
        if (!$user_id) {
            $this->session->set_flashdata('toast', ['type' => 'warning', 'message' => 'Your reset session has expired. Please request a new code.']);
            redirect('forgot');
        }

        $this->form_validation->set_rules('code', 'Verification Code', 'required|trim');
        $this->form_validation->set_rules('password', 'New Password', 'required|min_length[8]');
        $this->form_validation->set_rules('confirm_password', 'Confirm Password', 'required|matches[password]');

        if ($this->form_validation->run() === false) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => validation_errors(' ', ' ')]);
            redirect('reset');
        }

        $code     = trim($this->input->post('code', true));
        $password = $this->input->post('password', true);

        $valid = $this->User_model->verify_otp($user_id, $code);

        if (!$valid) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Invalid or expired verification code.']);
            redirect('reset');
        }

        $this->User_model->update_password($user_id, $password);

        // Set flashdata BEFORE clearing session vars so the toast survives the redirect.
        $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'Password reset successfully! You can now log in.']);
        $this->session->unset_userdata(['reset_user_id', 'reset_email']);
        redirect('login');
    }

    /** Destroy the session and return to the login page. */
    public function logout()
    {
        $this->session->sess_destroy();
        redirect('login');
    }

    /**
     * Send an OTP email via SMTP.
     *
     * @return bool TRUE when the mail server accepted the message.
     */
    private function _send_otp_email($email, $name, $otp, $is_reset = false)
    {
        $subject = $is_reset ? 'nexam — Password Reset Code' : 'nexam — Email Verification Code';
        $action  = $is_reset ? 'reset your password' : 'verify your email';

        $message = '<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1e293b">';
        $message .= '<h2 style="color:#1B3A5B;font-family:Google Sans,sans-serif">nexam</h2>';
        $message .= '<p>Hi ' . htmlspecialchars($name) . ',</p>';
        $message .= '<p>Use the code below to ' . $action . ':</p>';
        $message .= '<div style="text-align:center;margin:24px 0">';
        $message .= '<span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1B3A5B;background:#F4F6FA;padding:16px 32px;border-radius:12px;display:inline-block">' . htmlspecialchars($otp) . '</span>';
        $message .= '</div>';
        $message .= '<p style="color:#64748b;font-size:13px">This code expires in 15 minutes. If you did not request this, you can safely ignore this email.</p>';
        $message .= '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">';
        $message .= '<p style="color:#94a3b8;font-size:12px">nexam — TOS-aligned Exam Builder</p>';
        $message .= '</body></html>';

        $this->email->clear(true);
        $this->email->from(
            $this->config->item('from_email') ?: 'noreply@nexam.app',
            $this->config->item('from_name') ?: 'nexam'
        );
        $this->email->to($email);
        $this->email->subject($subject);
        $this->email->message($message);

        if ($this->email->send(false)) {
            return true;
        }

        // Log headers only — the body carries the OTP and must never be logged.
        log_message('error', 'OTP email failed for ' . $email . ' — ' . $this->email->print_debugger(array('headers')));

        return false;
    }
}
