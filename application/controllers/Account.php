<?php
defined('BASEPATH') or exit('No direct script access allowed');

/**
 * Account — JSON endpoints behind the topbar user menu.
 *
 * Extends CI_Controller rather than MY_Controller on purpose: MY_Controller
 * redirects unauthenticated requests to the login page, which an AJAX caller
 * cannot act on. These endpoints answer with 403 JSON instead.
 */
class Account extends CI_Controller
{
    /** Password-change attempts allowed inside the throttle window. */
    const MAX_PASSWORD_ATTEMPTS = 5;

    /** Throttle window for password changes, in seconds. */
    const PASSWORD_THROTTLE_WINDOW = 900;

    /** Largest profile photo accepted, in bytes. */
    const MAX_AVATAR_BYTES = 2097152;

    /** Where avatars live, relative to the web root. */
    const AVATAR_DIR = 'upload/avatars/';

    /** Accepted image types, mapped to the extension we store them under. */
    private static $avatar_types = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/gif'  => 'gif',
        'image/webp' => 'webp',
    ];

    public function __construct()
    {
        parent::__construct();
        $this->load->library(['session', 'form_validation']);
        $this->load->helper(['url', 'form', 'name']);
        $this->load->database();
        $this->load->model('User_model');
    }

    /**
     * Return the signed-in user's name parts so the profile dialog can seed
     * its fields. Rows created before names were split fall back to a parse
     * of the composed full name.
     */
    public function me()
    {
        if (!$this->session->userdata('logged_in')) {
            return $this->_json(403, ['message' => 'Your session has expired. Please sign in again.']);
        }

        $user = $this->User_model->find_by_id($this->session->userdata('user_id'));

        if (!$user) {
            return $this->_json(404, ['message' => 'Account not found.']);
        }

        $parts = $this->_name_parts($user);
        $parts['email']  = $user->email;
        $parts['avatar'] = $user->avatar_path !== '' ? base_url($user->avatar_path) : '';

        return $this->_json(200, $parts);
    }

    /** Update the signed-in user's name. */
    public function profile()
    {
        if (!$this->_guard()) return;
        $user_id = $this->session->userdata('user_id');

        $this->form_validation->set_rules('first_name', 'First name', 'required|trim|max_length[100]');
        $this->form_validation->set_rules('middle_name', 'Middle name', 'trim|max_length[100]');
        $this->form_validation->set_rules('last_name', 'Last name', 'required|trim|max_length[100]');
        $this->form_validation->set_rules('name_ext', 'Extension', 'trim|max_length[20]');

        if ($this->form_validation->run() === false) {
            return $this->_json(422, ['message' => trim(validation_errors(' ', ' '))]);
        }

        $first  = $this->input->post('first_name', true);
        $middle = $this->input->post('middle_name', true);
        $last   = $this->input->post('last_name', true);
        $ext    = $this->input->post('name_ext', true);

        $full_name = $this->User_model->update_name_parts($user_id, $first, $middle, $last, $ext);

        if ($full_name === false) {
            return $this->_json(500, ['message' => 'Could not save your profile. Please try again.']);
        }

        // Keep the shell in step with the new name.
        $this->session->set_userdata('full_name', $full_name);

        return $this->_json(200, [
            'message'   => 'Profile updated.',
            'full_name' => $full_name,
            'initials'  => strtoupper(substr($first, 0, 1) . substr($last, 0, 1)),
        ]);
    }

    /** Change the signed-in user's password after re-checking the current one. */
    public function password()
    {
        if (!$this->_guard()) return;
        $user_id = $this->session->userdata('user_id');

        if ($this->_password_attempts_exhausted()) {
            return $this->_json(429, [
                'message' => 'Too many attempts. Please wait 15 minutes before trying again.',
            ]);
        }

        $this->form_validation->set_rules('current_password', 'Current password', 'required');
        $this->form_validation->set_rules('new_password', 'New password', 'required|min_length[8]|max_length[255]');
        $this->form_validation->set_rules('confirm_password', 'Confirm password', 'required|matches[new_password]');

        if ($this->form_validation->run() === false) {
            return $this->_json(422, ['message' => trim(validation_errors(' ', ' '))]);
        }

        $user = $this->User_model->find_by_id($user_id);

        if (!$user || !password_verify($this->input->post('current_password'), $user->password_hash)) {
            $this->_record_password_attempt();
            return $this->_json(422, ['message' => 'Your current password is incorrect.']);
        }

        if (!$this->User_model->update_password($user_id, $this->input->post('new_password'))) {
            return $this->_json(500, ['message' => 'Could not change your password. Please try again.']);
        }

        $this->_clear_password_attempts();

        // A credential change is a good moment to rotate the session id.
        $this->session->sess_regenerate(true);

        return $this->_json(200, ['message' => 'Password changed.']);
    }

    /** Replace the signed-in user's profile photo. */
    public function avatar()
    {
        if (!$this->_guard()) return;
        $user_id = $this->session->userdata('user_id');

        if (empty($_FILES['photo']) || $_FILES['photo']['error'] === UPLOAD_ERR_NO_FILE) {
            return $this->_json(422, ['message' => 'Please choose an image first.']);
        }

        $file = $_FILES['photo'];

        if ($file['error'] !== UPLOAD_ERR_OK) {
            return $this->_json(422, ['message' => 'That file could not be uploaded. Please try again.']);
        }

        if ($file['size'] > self::MAX_AVATAR_BYTES) {
            return $this->_json(422, ['message' => 'Images must be 2 MB or smaller.']);
        }

        // Trust the file's contents, never its name or the browser's claim.
        $info = @getimagesize($file['tmp_name']);
        if ($info === false || !isset(self::$avatar_types[$info['mime']])) {
            return $this->_json(422, ['message' => 'Please choose a JPG, PNG, GIF or WebP image.']);
        }

        $filename = $this->generate_uuid() . '.' . self::$avatar_types[$info['mime']];
        $relative = self::AVATAR_DIR . $filename;
        $absolute = FCPATH . $relative;

        if (!is_dir(FCPATH . self::AVATAR_DIR)) {
            @mkdir(FCPATH . self::AVATAR_DIR, 0755, true);
        }

        if (!@move_uploaded_file($file['tmp_name'], $absolute)) {
            return $this->_json(500, ['message' => 'Could not save the image. Please try again.']);
        }

        @chmod($absolute, 0644);

        $user = $this->User_model->find_by_id($user_id);
        $this->User_model->update_avatar($user_id, $relative);
        $this->_delete_avatar_file($user);

        $this->session->set_userdata('avatar_path', $relative);

        return $this->_json(200, [
            'message' => 'Photo updated.',
            'avatar'  => base_url($relative),
        ]);
    }

    /** Drop the profile photo and fall back to initials. */
    public function avatar_remove()
    {
        if (!$this->_guard()) return;
        $user_id = $this->session->userdata('user_id');

        $user = $this->User_model->find_by_id($user_id);

        if (!$user || $user->avatar_path === '') {
            return $this->_json(422, ['message' => 'There is no photo to remove.']);
        }

        $this->User_model->update_avatar($user_id, '');
        $this->_delete_avatar_file($user);
        $this->session->set_userdata('avatar_path', '');

        return $this->_json(200, ['message' => 'Photo removed.', 'avatar' => '']);
    }

    /* ------------------------------------------------------------------
       Helpers
       ------------------------------------------------------------------ */

    /**
     * Allow only authenticated POSTs. Returns false (having already written the
     * error response) so the caller can return and let CI flush the output —
     * calling exit() here would discard the buffered JSON body.
     */
    private function _guard()
    {
        if (!$this->session->userdata('logged_in')) {
            $this->_json(403, ['message' => 'Your session has expired. Please sign in again.']);
            return false;
        }

        if ($this->input->method(true) !== 'POST') {
            $this->_json(405, ['message' => 'Method not allowed.']);
            return false;
        }

        return true;
    }

    /** Emit a JSON response carrying a fresh CSRF hash for the next request. */
    private function _json($status, $payload)
    {
        $payload['csrf_name'] = $this->security->get_csrf_token_name();
        $payload['csrf_hash'] = $this->security->get_csrf_hash();

        $this->output
            ->set_status_header($status)
            ->set_content_type('application/json')
            ->set_output(json_encode($payload));
    }

    private function _password_attempts_exhausted()
    {
        $state = $this->session->userdata('pwd_attempts');

        if (!is_array($state) || (time() - $state['first']) > self::PASSWORD_THROTTLE_WINDOW) {
            return false;
        }

        return $state['count'] >= self::MAX_PASSWORD_ATTEMPTS;
    }

    private function _record_password_attempt()
    {
        $state = $this->session->userdata('pwd_attempts');

        if (!is_array($state) || (time() - $state['first']) > self::PASSWORD_THROTTLE_WINDOW) {
            $state = ['count' => 0, 'first' => time()];
        }

        $state['count']++;
        $this->session->set_userdata('pwd_attempts', $state);
    }

    private function _clear_password_attempts()
    {
        $this->session->unset_userdata('pwd_attempts');
    }

    /** Remove a user's previous avatar file, guarding against path escapes. */
    private function _delete_avatar_file($user)
    {
        if (!$user || $user->avatar_path === '') return;

        // Only ever delete inside the avatar directory.
        if (strpos($user->avatar_path, self::AVATAR_DIR) !== 0) return;
        if (strpos($user->avatar_path, '..') !== false) return;

        $path = FCPATH . $user->avatar_path;
        if (is_file($path)) @unlink($path);
    }

    /** Generate a UUID v4 string. */
    private function generate_uuid()
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    /**
     * Name parts for a user row. Accounts created before the split columns
     * existed only carry `full_name`, so fall back to parsing that.
     */
    private function _name_parts($user)
    {
        if (trim($user->first_name) !== '' || trim($user->last_name) !== '') {
            return [
                'first_name'  => $user->first_name,
                'middle_name' => $user->middle_name,
                'last_name'   => $user->last_name,
                'name_ext'    => $user->name_ext,
            ];
        }

        return name_split($user->full_name);
    }
}
