$ErrorActionPreference = 'Stop'

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
  throw 'Git Bash not found. Install Git for Windows, then re-run deploy.cmd'
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
$SshKey = if ($env:HULY_SSH_KEY) { $env:HULY_SSH_KEY } else { Join-Path $env:USERPROFILE '.ssh\id_ed25519' }
$Vps = if ($env:HULY_VPS) { $env:HULY_VPS } else { 'root@148.230.67.132' }

if (-not (Test-Path $SshKey)) {
  throw "SSH key not found at $SshKey (kept local, never in git)."
}

# Everything after `deploy.cmd` is forwarded, e.g. `deploy.cmd status`.
$command = if ($args.Count -gt 0) { $args -join ' ' } else { 'deploy' }

$gitBash = Get-GitBash
$unixRoot = ConvertTo-GitBashPath $RepoRoot

# Forward the opt-in flags the orchestrator understands.
$passThrough = @('FRESH', 'FORCE', 'SKIP_SMOKE', 'NO_ROLLBACK', 'ALLOW_SERVER_CHANGES', 'HULY_FRONT_URL')
$envPrefix = ''
foreach ($name in $passThrough) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if ($value) { $envPrefix += "$name='$value' " }
}

Write-Host "==== aneeverse production deploy ===="
Write-Host "Target:  $Vps"
Write-Host "Command: $command"
if ($envPrefix) { Write-Host "Flags:   $envPrefix" }
Write-Host ''

$bashCommand = "cd '$unixRoot' && ${envPrefix}HULY_SSH_KEY='$SshKey' HULY_VPS='$Vps' ./scripts/huly-deploy-production.sh $command"
& $gitBash -lc $bashCommand
$rc = $LASTEXITCODE
if ($rc -ne 0) {
  Write-Host ''
  Write-Host "Deploy command '$command' failed (exit $rc)." -ForegroundColor Red
  exit $rc
}
