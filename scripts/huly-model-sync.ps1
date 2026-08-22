# Push fork model edits (models/**) into the local workspace DB.
#
# The transactor serves the model baked into its image, then layers model_tx on top,
# so editing models/** does nothing until the difference is written to model_tx.
# This builds our model, diffs it against the image's model, and applies the result.
param(
  [Parameter(Mandatory = $true)][string]$RepoRoot,
  [Parameter(Mandatory = $true)][string]$GitBash,
  [string]$TransactorContainer = 'dev-transactor_cockroach-1',
  [string]$WorkspaceContainer = 'dev-workspace_cockroach-1',
  [string]$CockroachContainer = 'dev-cockroach-1',
  [string]$Database = 'defaultdb'
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

$cacheDir = Join-Path $PSScriptRoot '.model-cache'
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

# Keyed by image id so a transactor upgrade invalidates the cached base model.
$imageId = (docker inspect --format '{{.Image}}' $TransactorContainer) -replace '[^A-Za-z0-9]', ''
if ([string]::IsNullOrWhiteSpace($imageId)) { throw "cannot inspect $TransactorContainer" }
$baseModel = Join-Path $cacheDir "model-base-$($imageId.Substring(0, [Math]::Min(16, $imageId.Length))).json"

if (-not (Test-Path $baseModel)) {
  Write-Host "extracting base model from $TransactorContainer"
  docker cp "$($TransactorContainer):/usr/src/app/model.json" $baseModel
  if ($LASTEXITCODE -ne 0) { throw 'failed to copy model.json out of the transactor' }
}

Write-Host 'compiling model packages'
$repoUnix = ConvertTo-GitBashPath $RepoRoot
& $GitBash -lc "cd '$repoUnix' && node common/scripts/install-run-rush.js build --to @hcengineering/model-all"
if ($LASTEXITCODE -ne 0) { throw 'model compile failed' }

Write-Host 'building fork model bundle'
$modelsAll = ConvertTo-GitBashPath (Join-Path $RepoRoot 'models\all')
& $GitBash -lc "cd '$modelsAll' && rushx bundle"
if ($LASTEXITCODE -ne 0) { throw 'model bundle build failed' }

$forkModel = Join-Path $RepoRoot 'models\all\bundle\model.json'
if (-not (Test-Path $forkModel)) { throw "model bundle missing at $forkModel" }

$patchSql = Join-Path $cacheDir 'patch-local.sql'
$appliedSql = Join-Path $cacheDir 'applied-local.sql'
node (Join-Path $PSScriptRoot 'huly-model-patch.mjs') --base $baseModel --fork $forkModel --out $patchSql
if ($LASTEXITCODE -ne 0) { throw 'model patch generation failed' }

# The patch is deterministic, so an identical file means the DB is already in sync and
# the transactor does not need recycling.
if ((Test-Path $appliedSql) -and
    ((Get-FileHash $patchSql).Hash -eq (Get-FileHash $appliedSql).Hash)) {
  Write-Host 'model already in sync'
  return
}

Write-Host 'applying model patch'
Get-Content $patchSql | docker exec -i $CockroachContainer ./cockroach sql --insecure --database=$Database
if ($LASTEXITCODE -ne 0) { throw 'applying the model patch failed' }

Copy-Item $patchSql $appliedSql -Force

Write-Host 'restarting transactor + workspace'
docker restart $TransactorContainer $WorkspaceContainer | Out-Null
Start-Sleep -Seconds 12
