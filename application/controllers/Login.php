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
        $this->form_validation->set_rules('full_name', 'Full Name', 'required|trim|max_length[255]');
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

        $full_name = trim($this->input->post('full_name', true));
        $password  = $this->input->post('password', true);

        $user_id = $this->User_model->create_user($email, $password, $full_name);

        if (!$user_id) {
            $this->session->set_flashdata('toast', ['type' => 'error', 'message' => 'Failed to create account. Please try again.']);
            redirect('register');
        }

        // Generate and send OTP
        $otp = $this->User_model->generate_otp($user_id);
        $this->_send_otp_email($email, $full_name, $otp);

        $this->session->set_userdata([
            'pending_otp_user_id' => $user_id,
            'pending_otp_email'   => $email,
        ]);

        $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'Account created! Check your email for the verification code.']);
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

        $otp = $this->User_model->generate_otp($user_id);
        $this->_send_otp_email($email, $user->full_name, $otp);

        $this->session->set_flashdata('toast', ['type' => 'info', 'message' => 'A new verification code has been sent.']);
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

        // Always show success to prevent email enumeration
        if ($user) {
            $otp = $this->User_model->generate_otp($user->id);
            $this->_send_otp_email($user->email, $user->full_name, $otp, true);

            $this->session->set_userdata([
                'reset_user_id' => $user->id,
                'reset_email'   => $user->email,
            ]);
        }

        $this->session->set_flashdata('toast', ['type' => 'info', 'message' => 'If an account exists for that email, a reset code has been sent.']);
        redirect('reset');
    }

    /** Show reset password (OTP entry + new password) form. */
    public function reset()
    {
        if (!$this->session->userdata('reset_user_id')) {
            redirect('login');
        }

        $data['email'] = $this->session->userdata('reset_email');
        $this->load->view('reset', $data);
    }

    /** Process password reset with OTP. */
    public function reset_submit()
    {
        $user_id = $this->session->userdata('reset_user_id');
        if (!$user_id) {
            redirect('login');
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

        $this->session->unset_userdata(['reset_user_id', 'reset_email']);
        $this->session->set_flashdata('toast', ['type' => 'success', 'message' => 'Password reset successfully! You can now log in.']);
        redirect('login');
    }

    /** Destroy the session and return to the login page. */
    public function logout()
    {
        $this->session->sess_destroy();
        redirect('login');
    }

    /** Send OTP email via SMTP. */
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

        $this->email->from('noreply@nexam.app', 'nexam');
        $this->email->to($email);
        $this->email->subject($subject);
        $this->email->message($message);
        $this->email->send();
    }
}
