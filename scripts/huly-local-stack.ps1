# Local Docker DB + local webpack UI (no production tunnel).
function Stop-ListenPort {
  param([int]$Port)
  $matches = netstat -ano | Select-String ":$Port\s+.*LISTENING"
  foreach ($line in $matches) {
    $procId = ($line.ToString().Trim() -split '\s+')[-1]
    if ($procId -match '^\d+$' -and [int]$procId -gt 0) {
      Write-Host "Stopping PID $procId on port $Port"
      & taskkill /F /PID $procId 2>$null | Out-Null
    }
  }
}

function ConvertTo-GitBashPath {
  param([string]$WinPath)
  $full = [System.IO.Path]::GetFullPath($WinPath)
  if ($full -match '^([A-Za-z]):\\(.*)$') {
    return '/' + $Matches[1].ToLower() + '/' + ($Matches[2] -replace '\\', '/')
  }
  return $full
}

function Get-GitBash {
  $candidates = @(
    'E:\Programs\Git\bin\bash.exe',
    'C:\Program Files\Git\bin\bash.exe',
    "$env:ProgramFiles\Git\bin\bash.exe"
  )
  foreach ($p in $candidates) {
    if (Test-Path $p) { return $p }
  }
  throw "Git Bash not found. Install Git for Windows, then re-run local.cmd"
}

function Ensure-Docker {
  try {
    docker info --format '{{.ServerVersion}}' | Out-Null
    return
  } catch { }

  $desktop = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'
  if (-not (Test-Path $desktop)) {
    $desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  }
  if (Test-Path $desktop) {
    Write-Host "==== starting Docker Desktop ===="
    Start-Process -FilePath $desktop
  } else {
    throw "Docker is not running and Docker Desktop was not found."
  }

  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    try {
      docker info --format '{{.ServerVersion}}' | Out-Null
      return
    } catch { }
  }
  throw "Docker Desktop started but the daemon is not ready yet. Wait and re-run local.cmd."
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
$WebpackPort = 8080
$NodeOptions = if ($env:NODE_OPTIONS) { $env:NODE_OPTIONS } else { '--max_old_space_size=8192' }
$DevDir = Join-Path $RepoRoot 'dev'

Ensure-Docker

Write-Host "==== stop old webpack on $WebpackPort ===="
Stop-ListenPort $WebpackPort

Write-Host "==== docker compose (local stack) ===="
Push-Location $DevDir
try {
  docker compose -f docker-compose.yaml -f docker-compose.min.yaml -f docker-compose.local-tags.yaml up -d
} finally {
  Pop-Location
}

Write-Host "==== wait for Cockroach ===="
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  docker exec dev-cockroach-1 ./cockroach sql --insecure --execute "SELECT 1;" 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ready) {
  throw "Cockroach did not become ready. Is Docker Desktop running?"
}

Write-Host "==== apply fork Client model ===="
& node (Join-Path $PSScriptRoot 'huly-local-apply-fork-model.mjs')
if ($LASTEXITCODE -ne 0) {
  throw "Failed to apply local Client model."
}

$gitBash = Get-GitBash
$prodUnix = ConvertTo-GitBashPath (Join-Path $RepoRoot 'dev\prod')
Write-Host "==== webpack  http://localhost:$WebpackPort  (Ctrl+C to stop) ===="
Write-Host "Local DB. Log in as user1 / 1234, workspace local-ws."
Write-Host "Client app is in the module switcher (not under Team)."

& $gitBash -lc "cd '$prodUnix' && NODE_OPTIONS='$NodeOptions' HULY_DEV_HOST=127.0.0.1 rushx dev-server"
