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
  throw "Git Bash not found. Install Git for Windows, then re-run ship.cmd"
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
$SshKey = if ($env:HULY_SSH_KEY) { $env:HULY_SSH_KEY } else { Join-Path $env:USERPROFILE '.ssh\id_ed25519' }
$Vps = if ($env:HULY_VPS) { $env:HULY_VPS } else { 'root@148.230.67.132' }

if (-not (Test-Path $SshKey)) {
  throw "SSH key not found at $SshKey (kept local, never in git)."
}

$gitBash = Get-GitBash
$unixRoot = ConvertTo-GitBashPath $RepoRoot

Write-Host "==== unified production deploy (all stages) ===="
Write-Host "Target: $Vps"
& $gitBash -lc "cd '$unixRoot' && HULY_SSH_KEY='$SshKey' HULY_VPS='$Vps' ./scripts/huly-deploy-production.sh all"
if ($LASTEXITCODE -ne 0) { throw "Unified production deploy failed" }

Write-Host ""
Write-Host "Live: https://huly.aneeverse.com"
Write-Host "Hard-refresh the browser (Ctrl+F5)."
