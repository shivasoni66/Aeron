<#
.SYNOPSIS
    AERON Ground Station - Install AERON Bridge Controller Service for Windows
.DESCRIPTION
    Installs the lightweight AERON Bridge Controller service as a background
    service that automatically starts upon current-user Windows login.

    IMPORTANT:
    The Bridge Controller starts automatically with Windows, but it strictly
    does NOT launch the Python telemetry bridge. The Python bridge is only
    launched when the operator presses 'START TELEMETRY' in the AERON Admin Dashboard.
#>

[CmdletBinding()]
param(
    [Parameter()]
    [switch]$StartImmediately = $true
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   AERON GROUND CONTROL STATION — CONTROLLER SERVICE INSTALLER   " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Resolve repository directory and paths
$repoRoot = $PSScriptRoot
$controllerScript = Join-Path $repoRoot "drone-bridge\controller\aeron_bridge_controller.py"

if (-not (Test-Path $controllerScript)) {
    Write-Error "Controller script not found at expected path: $controllerScript"
    exit 1
}

Write-Host "`n[1/5] Detecting Python 3 runtime..." -ForegroundColor Yellow
$pythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $pythonExe) {
    Write-Error "Python 3 is not found in system PATH. Please install Python 3 and ensure it is in PATH."
    exit 1
}

# Check for pythonw.exe (windowless python execution on Windows)
$pythonwExe = Join-Path (Split-Path $pythonExe) "pythonw.exe"
if (-not (Test-Path $pythonwExe)) {
    $pythonwExe = $pythonExe
}
Write-Host "  OK: Using Python executable: $pythonwExe" -ForegroundColor Green

# 2. Setup user configuration directory
Write-Host "`n[2/5] Initializing AERON user configuration directory..." -ForegroundColor Yellow
$userConfigDir = Join-Path $env:USERPROFILE ".aeron"
if (-not (Test-Path $userConfigDir)) {
    New-Item -ItemType Directory -Path $userConfigDir -Force | Out-Null
}

# 3. Verify or generate cryptographic local authentication token
Write-Host "`n[3/5] Verifying local authentication token..." -ForegroundColor Yellow
$tokenFile = Join-Path $repoRoot ".aeron-bridge-token"
if (-not (Test-Path $tokenFile)) {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $tokenHex = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
    [System.IO.File]::WriteAllText($tokenFile, $tokenHex)
    Write-Host "  OK: Generated new cryptographic token (saved to .aeron-bridge-token)" -ForegroundColor Green
} else {
    $tokenHex = (Get-Content $tokenFile -Raw).Trim()
    Write-Host "  OK: Existing token verified (${tokenHex.Length} characters)" -ForegroundColor Green
}

# Also sync token into user config directory for persistence
$userTokenFile = Join-Path $userConfigDir "bridge-controller.token"
[System.IO.File]::WriteAllText($userTokenFile, $tokenHex)

# 4. Create background runner script
Write-Host "`n[4/5] Creating background service runner..." -ForegroundColor Yellow
$vbsPath = Join-Path $userConfigDir "run-aeron-bridge-controller.vbs"
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$repoRoot"
WshShell.Run """$pythonwExe"" ""$controllerScript""", 0, False
"@
[System.IO.File]::WriteAllText($vbsPath, $vbsContent)
Write-Host "  OK: Background runner created at $vbsPath" -ForegroundColor Green

# 5. Register Startup shortcut in current-user Startup folder
Write-Host "`n[5/5] Registering AERON Controller for current-user login..." -ForegroundColor Yellow
$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder "AERON-Bridge-Controller.lnk"

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$vbsPath`""
$shortcut.WorkingDirectory = $repoRoot
$shortcut.Description = "AERON Ground Control Station - Local Bridge Controller Service"
$shortcut.IconLocation = "$pythonExe,0"
$shortcut.Save()
Write-Host "  OK: Startup shortcut registered: $shortcutPath" -ForegroundColor Green

# 6. Launch immediately if requested
if ($StartImmediately) {
    Write-Host "`nStarting AERON Bridge Controller service now..." -ForegroundColor Cyan

    # Check if already running on port 8765
    $isRunning = $false
    try {
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($resp.status -eq "ok") {
            $isRunning = $true
            Write-Host "  AERON Bridge Controller is already active on http://127.0.0.1:8765 (PID: $($resp.pid))." -ForegroundColor Green
        }
    } catch {
        $isRunning = $false
    }

    if (-not $isRunning) {
        Start-Process "wscript.exe" -ArgumentList "`"$vbsPath`"" -WorkingDirectory $repoRoot
        Start-Sleep -Seconds 1.5

        # Verify health
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 2
            if ($health.status -eq "ok") {
                Write-Host "  SUCCESS: Controller verified active on http://127.0.0.1:8765 (PID: $($health.pid))" -ForegroundColor Green
            }
        } catch {
            Write-Warning "Controller started, but health check timed out. Please check logs."
        }
    }
}

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "   INSTALLATION COMPLETE — AERON BRIDGE CONTROLLER ACTIVE         " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "Service URL      : http://127.0.0.1:8765"
Write-Host "Network Binding  : Loopback only (127.0.0.1)"
Write-Host "Startup Behavior : Runs on user login (telemetry bridge remains STOPPED until operator clicks Start)"
Write-Host "Auth Token File  : $tokenFile"
Write-Host "To uninstall run : .\uninstall-aeron-controller.ps1`n"

