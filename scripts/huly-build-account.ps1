# Build the custom account image from this fork's server/account code.
#
# The account service is a compiled bundle inside hardcoreeng/account, so unlike
# models/** there is no database-side trick that can add a method to it. The API
# token endpoints only exist once we run our own image.
#
# Thin wrapper around scripts/huly-build-account.sh — the npm scripts it drives
# use `rm`, which fails in PowerShell, so the real work runs under Git Bash.
param(
  [string]$Tag,
  [switch]$NoBuild
)

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
  throw 'Git Bash not found. Install Git for Windows, then re-run account.cmd'
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
$gitBash = Get-GitBash
$repoUnix = ConvertTo-GitBashPath $RepoRoot

$argsList = @()
if ($Tag) { $argsList += "--tag '$Tag'" }
if ($NoBuild) { $argsList += '--no-build' }

& $gitBash -lc "cd '$repoUnix' && bash scripts/huly-build-account.sh $($argsList -join ' ')"
if ($LASTEXITCODE -ne 0) { throw 'account image build failed' }
