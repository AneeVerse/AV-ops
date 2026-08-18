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
$prodUnix = ConvertTo-GitBashPath (Join-Path $RepoRoot 'dev\prod')

Write-Host "==== build front bundle ===="
& $gitBash -lc "cd '$prodUnix' && NODE_OPTIONS=--max-old-space-size=8192 rushx package && cp -r public/huly dist/huly 2>/dev/null || true && rm -f dist/config.json && tar --exclude='*.map' --exclude='*.map.gz' --exclude='report.html' -czf huly-front-dist.tgz -C dist ."
if ($LASTEXITCODE -ne 0) { throw "webpack package failed" }

$tgz = Join-Path $RepoRoot 'dev\prod\huly-front-dist.tgz'
$deploySh = Join-Path $RepoRoot 'scripts\huly-deploy-front.sh'
if (-not (Test-Path $tgz)) { throw "Missing $tgz" }

Write-Host "==== upload to VPS ===="
& scp -o BatchMode=yes -i $SshKey $tgz $deploySh "${Vps}:/tmp/"
if ($LASTEXITCODE -ne 0) { throw "scp failed" }

Write-Host "==== deploy on VPS ===="
& ssh -o BatchMode=yes -o ConnectTimeout=20 -i $SshKey $Vps 'bash /tmp/huly-deploy-front.sh'
if ($LASTEXITCODE -ne 0) { throw "VPS deploy failed" }

Write-Host ""
Write-Host "Live: https://huly.aneeverse.com"
Write-Host "Hard-refresh the browser (Ctrl+F5)."
