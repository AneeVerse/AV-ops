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

function Ensure-HulyLocalHosts {
  # Browser config (collaborator, datalake, pulse, etc.) uses huly.local.
  # Without this mapping, Playwright/SPA hits ERR_NAME_NOT_RESOLVED and can drop session.
  $hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
  $mapped = $false
  try {
    $addrs = [System.Net.Dns]::GetHostAddresses('huly.local')
    foreach ($a in $addrs) {
      if ($a.ToString() -eq '127.0.0.1' -or $a.ToString() -eq '::1') { $mapped = $true; break }
    }
  } catch { }

  if ($mapped) {
    Write-Host "==== huly.local resolves to loopback ===="
    return
  }

  Write-Host "==== huly.local missing; attempting hosts mapping ===="
  $line = '127.0.0.1 huly.local'
  try {
    $existing = Get-Content $hostsPath -ErrorAction Stop
    $has = $false
    foreach ($l in $existing) {
      if ($l -match '^\s*127\.0\.0\.1\s+huly\.local\s*$') { $has = $true; break }
    }
    if (-not $has) {
      Add-Content -Path $hostsPath -Value "`r`n$line" -Encoding ascii -ErrorAction Stop
    }
    ipconfig /flushdns | Out-Null
    Write-Host "Mapped 127.0.0.1 huly.local in hosts."
  } catch {
    Write-Host "WARNING: Could not update hosts (need Admin). Add this line manually:"
    Write-Host "  $line"
    Write-Host "Then: ipconfig /flushdns"
    Write-Host "Without it, ws://huly.local:* and http://huly.local:* will fail in the browser."
  }
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
Ensure-HulyLocalHosts

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

Write-Host "==== drop stale fork model rows ===="
$cleanupSql = Join-Path $PSScriptRoot 'huly-cleanup-local-model.sql'
$cleanupOut = Get-Content $cleanupSql | docker exec -i dev-cockroach-1 ./cockroach sql --insecure --database=defaultdb --format=tsv
if ($LASTEXITCODE -ne 0) {
  Write-Host "WARNING: local model cleanup failed. Old /company/* URLs may crash the workbench."
  Write-Host ($cleanupOut -join "`n")
} elseif ($cleanupOut -match '^DELETE [1-9]') {
  # Transactor and workspace cache the model at session start, so they must be
  # recycled for the delete to take effect.
  Write-Host "Removed stale rows; restarting transactor + workspace."
  docker restart dev-transactor_cockroach-1 dev-workspace_cockroach-1 | Out-Null
  Start-Sleep -Seconds 12
}

Write-Host "==== re-enable integration plugins ===="
$integrationsSql = Join-Path $PSScriptRoot 'huly-enable-integrations.sql'
$integrationsOut = Get-Content $integrationsSql | docker exec -i dev-cockroach-1 ./cockroach sql --insecure --database=defaultdb --format=tsv
if ($LASTEXITCODE -ne 0) {
  Write-Host "WARNING: could not re-enable integration plugins. Settings -> Integrations may be empty."
  Write-Host ($integrationsOut -join "`n")
}

$gitBash = Get-GitBash

Write-Host "==== sync fork model into local DB ===="
& (Join-Path $PSScriptRoot 'huly-model-sync.ps1') -RepoRoot $RepoRoot -GitBash $gitBash

$prodUnix = ConvertTo-GitBashPath (Join-Path $RepoRoot 'dev\prod')
Write-Host "==== webpack  http://localhost:$WebpackPort  (Ctrl+C to stop) ===="
Write-Host "Local DB. Log in as user1 / 1234, workspace local-ws."

& $gitBash -lc "cd '$prodUnix' && NODE_OPTIONS='$NodeOptions' HULY_DEV_HOST=127.0.0.1 rushx dev-server"
