<#
.SYNOPSIS
    AERON Ground Station - Physical Pixhawk 2.4.8 Telemetry Bridge Startup Script
.DESCRIPTION
    Verifies the Python environment, activates virtual environment if present,
    checks dependencies and backend connectivity, and launches the real-time
    dual-transport MAVLink telemetry bridge with proper parameters.
.PARAMETER Transport
    Telemetry transport mode: 'dual', 'wifi', or 'usb'. Default: 'dual'.
.PARAMETER Primary
    Preferred primary transport in dual mode: 'wifi' or 'usb'. Default: 'wifi'.
.PARAMETER WifiHost
    ESP32 Station Mode IP, 'auto', or mDNS hostname. Default: 'auto'.
.PARAMETER WifiPort
    TCP port for MAVLink stream. Default: 5760.
.PARAMETER WifiFallbackIp
    Fallback IP if mDNS/UDP auto-discovery times out. Default: '192.168.4.1'.
.PARAMETER WifiUdpPort
    UDP port for ESP32 discovery beacon. Default: 37020.
.PARAMETER UsbPort
    Serial COM port for Pixhawk / ESP32 USB telemetry. Default from .env or 'COM8'.
.PARAMETER UsbBaud
    Serial baud rate for USB connection. Default from .env or 115200.
.PARAMETER DroneId
    Airframe identification tag. Default from .env or 'AERON-HEX-01'.
.PARAMETER BackendUrl
    Backend telemetry ingestion endpoint. Default from .env or 'http://localhost:5000/api/v1'.
.PARAMETER SimulationFallback
    Run software bench simulation instead of real hardware link.
.PARAMETER DryRun
    Construct and display arguments without launching the Python process.
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("dual", "wifi", "usb", IgnoreCase = $true)]
    [string]$Transport = "dual",

    [Parameter()]
    [Alias("PrimaryTransport")]
    [ValidateSet("wifi", "usb", IgnoreCase = $true)]
    [string]$Primary = "wifi",

    [Parameter()]
    [string]$WifiHost = "auto",

    [Parameter()]
    [int]$WifiPort = 5760,

    [Parameter()]
    [string]$WifiFallbackIp = "192.168.4.1",

    [Parameter()]
    [int]$WifiUdpPort = 37020,

    [Parameter()]
    [Alias("ComPort")]
    [string]$UsbPort = "",

    [Parameter()]
    [Alias("Baud")]
    [int]$UsbBaud = 0,

    [Parameter()]
    [string]$DroneId = "",

    [Parameter()]
    [string]$BackendUrl = "",

    [Parameter()]
    [switch]$Camera,

    [Parameter()]
    [string]$CameraHost = "",

    [Parameter()]
    [int]$CameraPort = 0,

    [Parameter()]
    [string]$CameraProtocol = "",

    [Parameter()]
    [double]$CameraFps = 0.0,

    [Parameter()]
    [switch]$SimulationFallback,

    [Parameter()]
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Ensure working directory is set to drone-bridge
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir
$env:PYTHONPATH = $ScriptDir

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   AERON GROUND CONTROL STATION - PIXHAWK TELEMETRY BRIDGE        " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# 1. Detect Python Runtime and Virtual Environment
# -----------------------------------------------------------------------------
Write-Host "[1/6] Detecting Python runtime..." -ForegroundColor Yellow

$venvPaths = @(
    (Join-Path $ScriptDir ".venv"),
    (Join-Path $ScriptDir "venv"),
    (Join-Path (Split-Path -Parent $ScriptDir) ".venv"),
    (Join-Path (Split-Path -Parent $ScriptDir) "venv")
)

$pythonExe = "python"
foreach ($vp in $venvPaths) {
    $cand = Join-Path $vp "Scripts\python.exe"
    if (Test-Path $cand) {
        $pythonExe = $cand
        Write-Host "  OK: Active Virtual Environment found at '${vp}'" -ForegroundColor Green
        break
    }
}

try {
    $pyVer = & $pythonExe --version 2>&1
    Write-Host "  OK: Python runtime verified (${pyVer})." -ForegroundColor Green
} catch {
    Write-Error "Python executable '${pythonExe}' could not be executed. Please ensure Python 3.10+ is installed and available in PATH."
    exit 1
}

# -----------------------------------------------------------------------------
# 2. Check Python Dependencies
# -----------------------------------------------------------------------------
Write-Host "[2/6] Checking required Python dependencies..." -ForegroundColor Yellow

$depCheckCode = @'
import sys
mods = ['pymavlink', 'serial', 'requests']
for m in mods:
    try:
        __import__(m)
    except ImportError:
        sys.exit(1)
sys.exit(0)
'@

& $pythonExe -c $depCheckCode 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Warning "Required Python modules are missing. Installing from requirements.txt..."
    & $pythonExe -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install required Python dependencies from requirements.txt."
        exit 1
    }
}
Write-Host "  OK: pymavlink, pyserial, and requests verified." -ForegroundColor Green

# -----------------------------------------------------------------------------
# 3. Environment Configuration (.env)
# -----------------------------------------------------------------------------
Write-Host "[3/6] Validating environment configuration..." -ForegroundColor Yellow

$envPath = Join-Path $ScriptDir ".env"
if (-not (Test-Path $envPath)) {
    $examplePath = Join-Path $ScriptDir ".env.example"
    if (Test-Path $examplePath) {
        Write-Warning "Local environment file .env not found. Initializing from .env.example..."
        Copy-Item $examplePath $envPath
    }
}

$envConfig = @{}
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $envConfig[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
        }
    }
}

# Reconcile user parameters with .env fallbacks
$activeUsbPort = if ($UsbPort) { $UsbPort } elseif ($envConfig["AERON_USB_PORT"]) { $envConfig["AERON_USB_PORT"] } elseif ($envConfig["MAVLINK_CONNECTION"]) { $envConfig["MAVLINK_CONNECTION"] } else { "COM8" }
$activeUsbBaud = if ($UsbBaud -gt 0) { $UsbBaud } elseif ($envConfig["AERON_USB_BAUD"]) { [int]$envConfig["AERON_USB_BAUD"] } elseif ($envConfig["MAVLINK_BAUD"]) { [int]$envConfig["MAVLINK_BAUD"] } else { 115200 }
$activeDroneId = if ($DroneId) { $DroneId } elseif ($envConfig["DRONE_ID"]) { $envConfig["DRONE_ID"] } else { "AERON-HEX-01" }
$activeBackend = if ($BackendUrl) { $BackendUrl } elseif ($envConfig["AERON_BACKEND_URL"]) { $envConfig["AERON_BACKEND_URL"] } else { "http://localhost:5000/api/v1" }

$activeCameraEnabled = if ($Camera) { $true } elseif ($envConfig["CAMERA_ENABLED"] -in @("true", "1", "yes")) { $true } else { $false }
$activeCameraHost = if ($CameraHost) { $CameraHost } elseif ($envConfig["CAMERA_HOST"]) { $envConfig["CAMERA_HOST"] } else { "10.231.241.200" }
$activeCameraPort = if ($CameraPort -gt 0) { $CameraPort } elseif ($envConfig["CAMERA_PORT"]) { [int]$envConfig["CAMERA_PORT"] } else { 81 }
$activeCameraFps = if ($CameraFps -gt 0) { $CameraFps } elseif ($envConfig["CAMERA_TARGET_FPS"]) { [double]$envConfig["CAMERA_TARGET_FPS"] } else { 5.0 }
$activeCameraProtocol = if ($CameraProtocol) { $CameraProtocol } elseif ($envConfig["CAMERA_PROTOCOL"]) { $envConfig["CAMERA_PROTOCOL"] } else { "MJPEG" }

Write-Host "  Airframe ID   : ${activeDroneId}" -ForegroundColor White
Write-Host "  Transport Mode: ${Transport}" -ForegroundColor White
if ($activeCameraEnabled) {
    Write-Host "  Camera Relay  : ENABLED (http://${activeCameraHost}:${activeCameraPort} @ ${activeCameraFps} FPS via ${activeCameraProtocol})" -ForegroundColor Cyan
} else {
    Write-Host "  Camera Relay  : Disabled" -ForegroundColor DarkGray
}

# -----------------------------------------------------------------------------
# 4. Check Backend Health
# -----------------------------------------------------------------------------
Write-Host "[4/6] Checking AERON Backend reachability (${activeBackend})..." -ForegroundColor Yellow

$healthUrl = $activeBackend.Replace("/api/v1", "").TrimEnd("/") + "/health"
try {
    $healthResp = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 4 -ErrorAction Stop
    Write-Host "  OK: Backend is $($healthResp.status) (uptime: $($healthResp.uptimeSeconds)s)." -ForegroundColor Green
} catch {
    Write-Warning "Backend health check to ${healthUrl} returned error: $_"
    Write-Host "  Proceeding with bridge startup (offline telemetry queue active)." -ForegroundColor Yellow
}

# -----------------------------------------------------------------------------
# 5. Detect and Verify Transport Paths
# -----------------------------------------------------------------------------
Write-Host "[5/6] Validating transport connection requirements..." -ForegroundColor Yellow

if ($SimulationFallback) {
    Write-Host "  SIMULATION FALLBACK REQUESTED. Starting simulated bench telemetry..." -ForegroundColor Magenta
    $simArgs = @("-m", "src.main", "--simulator", "--drone-id", $activeDroneId, "--backend-url", $activeBackend)
    if ($activeCameraEnabled) {
        $simArgs += @("--camera", "--camera-host", $activeCameraHost, "--camera-port", [string]$activeCameraPort, "--camera-protocol", $activeCameraProtocol, "--camera-fps", [string]$activeCameraFps)
    }
    if ($DryRun) {
        Write-Host "  DRY RUN: Arguments verified -> $pythonExe $($simArgs -join ' ')" -ForegroundColor Cyan
        exit 0
    }
    & $pythonExe @simArgs
    exit $LASTEXITCODE
}

# For Wi-Fi only mode: COM port is NOT required and NOT opened
if ($Transport -eq "wifi") {
    Write-Host "  Wi-Fi only mode selected. Skipping USB serial port detection." -ForegroundColor Green
} else {
    # For USB or Dual mode: check active Windows COM ports
    $availablePorts = [System.IO.Ports.SerialPort]::GetPortNames()

    if ($availablePorts -notcontains $activeUsbPort) {
        Write-Warning "Configured port '${activeUsbPort}' was not immediately found in active COM ports: $($availablePorts -join ', ')"

        # Check for connected Pixhawk or USB serial device via PNP
        $pnpDevice = Get-PnpDevice -Class Ports -PresentOnly -ErrorAction SilentlyContinue |
            Where-Object { $_.FriendlyName -match 'COM\d+' -or $_.InstanceId -like '*VID_1209*PID_5741*' } |
            Select-Object -First 1

        if ($pnpDevice -and ($pnpDevice.FriendlyName -match '(COM\d+)')) {
            $autoPort = $matches[1]
            Write-Host "  Auto-detected active USB device on ${autoPort}!" -ForegroundColor Cyan
            $activeUsbPort = $autoPort
        } else {
            if ($Transport -eq "usb") {
                $errMsg = @(
                    "Pixhawk 2.4.8 USB hardware is NOT detected on ${activeUsbPort}.",
                    "- Ensure the USB cable is plugged into Pixhawk/ESP32 and laptop.",
                    "- Verify using a data-capable cable (not charge-only).",
                    "- Check Windows Device Manager under Ports (COM and LPT).",
                    "- To run software bench simulation instead, pass -SimulationFallback."
                ) -join "`n"
                if (-not $DryRun) {
                    Write-Error $errMsg
                    exit 1
                } else {
                    Write-Warning $errMsg
                }
            } else {
                # Dual mode: Wi-Fi primary can still operate while USB stands by for cable insertion
                $warnMsg = @(
                    "USB Serial port '${activeUsbPort}' is currently disconnected.",
                    "Dual mode will start with Wi-Fi as primary transport; USB fallback will connect automatically once plugged in."
                ) -join "`n"
                Write-Warning $warnMsg
            }
        }
    } else {
        Write-Host "  OK: Identified serial device on ${activeUsbPort} at ${activeUsbBaud} baud." -ForegroundColor Green
    }
}

# -----------------------------------------------------------------------------
# 6. Prevent Duplicate Processes and Launch Real-Time Bridge
# -----------------------------------------------------------------------------
Write-Host "[6/6] Launching AERON Telemetry Bridge..." -ForegroundColor Cyan

# Terminate any previously running instances of src.main to prevent COM/TCP port locking
if (-not $DryRun) {
    $priorInstances = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%src.main%'" -ErrorAction SilentlyContinue
    if ($priorInstances) {
        foreach ($inst in $priorInstances) {
            Write-Warning "Terminating previous bridge instance (PID: $($inst.ProcessId))..."
            Stop-Process -Id $inst.ProcessId -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Milliseconds 600
    }
}

# Build CLI arguments array cleanly
$pyArgs = @(
    "-m", "src.main",
    "--transport", $Transport,
    "--drone-id", $activeDroneId,
    "--backend-url", $activeBackend
)

if ($Transport -in @("wifi", "dual")) {
    $pyArgs += @(
        "--primary-transport", $Primary,
        "--wifi-host", $WifiHost,
        "--wifi-port", [string]$WifiPort,
        "--wifi-fallback-ip", $WifiFallbackIp,
        "--wifi-udp-port", [string]$WifiUdpPort
    )
}

if ($Transport -in @("usb", "dual")) {
    $pyArgs += @(
        "--usb-port", $activeUsbPort,
        "--usb-baud", [string]$activeUsbBaud
    )
}

if ($activeCameraEnabled) {
    $pyArgs += @(
        "--camera",
        "--camera-host", $activeCameraHost,
        "--camera-port", [string]$activeCameraPort,
        "--camera-protocol", $activeCameraProtocol,
        "--camera-fps", [string]$activeCameraFps
    )
}

Write-Host "  Command: $pythonExe $($pyArgs -join ' ')" -ForegroundColor DarkGray

if ($DryRun) {
    Write-Host "`n  DRY RUN COMPLETED SUCCESSFULLY: Argument construction validated." -ForegroundColor Green
    exit 0
}

Write-Host "  Press Ctrl+C to terminate the bridge cleanly.`n" -ForegroundColor Yellow

& $pythonExe @pyArgs
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Error "AERON Telemetry Bridge exited with error code: ${exitCode}"
    exit $exitCode
}
