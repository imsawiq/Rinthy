$ErrorActionPreference = "Stop"

$Port = 3000
$HostName = "127.0.0.1"
$Url = "http://${HostName}:$Port"
$WindowSize = "390,844"
$UserDataDir = Join-Path $env:TEMP ("rinthy-app-browser-profile-" + [guid]::NewGuid().ToString("N"))

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Test-DevServer {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -Method Get -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Get-BrowserPath {
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  throw "Chrome or Edge was not found in the usual Windows install paths."
}

$serverProcess = $null

if (-not (Test-DevServer)) {
  $pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  if (-not $pnpm) {
    $pnpm = Get-Command pnpm -ErrorAction Stop
  }

  Write-Host "Starting Vite at $Url..."
  $serverProcess = Start-Process `
    -FilePath $pnpm.Source `
    -ArgumentList @("exec", "vite", "--host", $HostName, "--port", "$Port", "--strictPort") `
    -PassThru `
    -NoNewWindow

  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline) {
    if (Test-DevServer) {
      break
    }
    Start-Sleep -Milliseconds 500
  }

  if (-not (Test-DevServer)) {
    if ($serverProcess -and -not $serverProcess.HasExited) {
      Stop-Process -Id $serverProcess.Id -Force
    }
    throw "Vite did not become available at $Url within 30 seconds."
  }
} else {
  Write-Host "Using already running Vite at $Url..."
}

$browser = Get-BrowserPath
Write-Host "Opening app window with $browser..."
Start-Process -FilePath $browser -ArgumentList @(
  "--app=$Url",
  "--window-size=$WindowSize",
  "--user-data-dir=$UserDataDir",
  "--no-first-run"
)

if ($serverProcess) {
  Write-Host "Vite is running. Press Ctrl+C to stop."
  try {
    Wait-Process -Id $serverProcess.Id
  } finally {
    if (-not $serverProcess.HasExited) {
      Stop-Process -Id $serverProcess.Id -Force
    }
  }
}
