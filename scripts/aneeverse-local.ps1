# Stop anything already listening on a TCP port (webpack / leftover ssh).
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

$RepoRoot = Split-Path -Parent $PSScriptRoot
$SshKey = if ($env:HULY_SSH_KEY) { $env:HULY_SSH_KEY } else { Join-Path $env:USERPROFILE '.ssh\id_ed25519' }
$Vps = if ($env:HULY_VPS) { $env:HULY_VPS } else { 'root@148.230.67.132' }
$TunnelPort = 18087
$WebpackPort = 8080
$NodeOptions = if ($env:NODE_OPTIONS) { $env:NODE_OPTIONS } else { '--max_old_space_size=8192' }

if (-not (Test-Path $SshKey)) {
  throw "SSH key not found at $SshKey (kept local, never in git). Put your key there or set HULY_SSH_KEY."
}

Write-Host "==== stop old local UI / tunnel ===="
Stop-ListenPort $WebpackPort
Stop-ListenPort $TunnelPort
Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match "$TunnelPort" } |
  ForEach-Object {
    Write-Host "Stopping leftover ssh PID $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

Write-Host "==== SSH tunnel  localhost:$TunnelPort -> ${Vps}:8087 ===="
$ssh = Start-Process -FilePath 'ssh' -PassThru -WindowStyle Hidden -ArgumentList @(
  '-N',
  '-o', 'BatchMode=yes',
  '-o', 'ExitOnForwardFailure=yes',
  '-o', 'ServerAliveInterval=30',
  '-i', $SshKey,
  '-L', "${TunnelPort}:127.0.0.1:8087",
  $Vps
)

$ready = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 1
  if ($ssh.HasExited) {
    throw "SSH tunnel exited. Check VPN/key and that you can: ssh -i `"$SshKey`" $Vps"
  }
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$TunnelPort/" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -ge 200) { $ready = $true; break }
  } catch { }
}
if (-not $ready) {
  Stop-Process -Id $ssh.Id -Force -ErrorAction SilentlyContinue
  throw "Tunnel started but localhost:$TunnelPort did not respond."
}

$gitBash = Get-GitBash
$prodUnix = ConvertTo-GitBashPath (Join-Path $RepoRoot 'dev\prod')
Write-Host "==== webpack  http://localhost:$WebpackPort  (Ctrl+C to stop) ===="
Write-Host "Log in with the same production account. Edits hit the live workspace."

try {
  & $gitBash -lc "cd '$prodUnix' && NODE_OPTIONS='$NodeOptions' HULY_PROD_PROXY=http://127.0.0.1:$TunnelPort rushx dev-aneeverse"
} finally {
  Write-Host "==== stopping tunnel ===="
  if ($ssh -and -not $ssh.HasExited) {
    Stop-Process -Id $ssh.Id -Force -ErrorAction SilentlyContinue
  }
  Stop-ListenPort $TunnelPort
  Stop-ListenPort $WebpackPort
}
