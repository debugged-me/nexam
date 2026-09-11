# nexam

## SMTP setup for registration emails

SMTP credentials are intentionally not committed to Git. Every computer that
runs its own copy of nexam must create a local email configuration file.

### Windows with XAMPP

1. Pull the latest project changes.
2. Right-click `setup-email-windows.ps1` and choose **Run with PowerShell**.
3. Enter the password for `nexam@mati.gov.ph` when prompted. The password is
   written only to the local, Git-ignored configuration file.
4. Fully stop and restart Apache from the XAMPP Control Panel.

If **Run with PowerShell** is unavailable, open PowerShell in the project
directory (for example, `C:\xampp\htdocs\nexam`) and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-email-windows.ps1
```

The local file is ignored by Git. Do not commit the mailbox password.

### Production

Set `NEXAM_SMTP_PASS` in the Apache/PHP process environment. The optional
variables `NEXAM_SMTP_HOST`, `NEXAM_SMTP_USER`, `NEXAM_SMTP_PORT`, and
`NEXAM_SMTP_CRYPTO` can override the defaults in
`application/config/email.php`.

The default server settings are authenticated implicit TLS on
`mail.mati.gov.ph:465`.
