$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$configDirectory = Join-Path $projectRoot 'application\config\development'
$configPath = Join-Path $configDirectory 'email.php'

Write-Host 'nexam SMTP setup' -ForegroundColor Cyan
Write-Host 'This creates a local, Git-ignored email configuration for this computer.'

$securePassword = Read-Host 'Password for nexam@mati.gov.ph' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

    if ([string]::IsNullOrWhiteSpace($plainPassword)) {
        throw 'The SMTP password cannot be empty.'
    }

    if ($plainPassword.Contains("`r") -or $plainPassword.Contains("`n")) {
        throw 'The SMTP password cannot contain a line break.'
    }

    $phpPassword = $plainPassword.Replace('\', '\\').Replace("'", "\'")
    $configContents = @"
<?php defined('BASEPATH') or exit('No direct script access allowed');

// Local-only override. This directory is ignored by Git.
`$config['smtp_pass'] = '$phpPassword';
"@

    New-Item -ItemType Directory -Force -Path $configDirectory | Out-Null
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($configPath, $configContents, $utf8WithoutBom)

    Write-Host ''
    Write-Host "Created: $configPath" -ForegroundColor Green
    Write-Host 'Fully stop and restart Apache in the XAMPP Control Panel, then use Resend code.'
}
finally {
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }

    $plainPassword = $null
    $phpPassword = $null
}
