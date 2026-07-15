param(
  [Parameter(Mandatory = $true)]
  [string]$Roles,

  [ValidateSet('hidden', 'disabled')]
  [string]$DisabledRoleDisplay = 'hidden',

  [string]$Version = '',

  [string]$OutputDir = 'dist'
)

$ErrorActionPreference = 'Stop'

function Resolve-BuilderRoot {
  $scriptDir = $PSScriptRoot
  if ([string]::IsNullOrWhiteSpace($scriptDir)) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  }
  if ([string]::IsNullOrWhiteSpace($scriptDir)) {
    $scriptDir = (Get-Location).Path
  }

  $candidates = @()
  $candidates += $scriptDir
  $candidates += (Join-Path $scriptDir '..')
  $candidates += (Get-Location).Path

  foreach ($candidate in $candidates) {
    try {
      $full = (Resolve-Path $candidate).Path
      if (Test-Path (Join-Path $full 'extension-src\manifest.json')) {
        return $full
      }
    } catch {
    }
  }

  throw 'Cannot find extension-src\manifest.json. Please run the command in the builder package folder.'
}

function Normalize-Roles([string]$rawRoles) {
  $tokens = @()
  $raw = ($rawRoles -replace '\s+', '')
  if ($raw -ieq 'all') {
    return @('1', '2', '3')
  }

  foreach ($ch in $raw.ToCharArray()) {
    $s = [string]$ch
    if ($s -eq ',' -or $s -eq ';') {
      continue
    }
    if ($s -eq '1' -or $s -eq '2' -or $s -eq '3') {
      $tokens += $s
    } else {
      throw "Invalid role: $s. Only 1, 2, 3 are supported."
    }
  }

  $unique = $tokens | Sort-Object -Unique
  if (-not $unique -or $unique.Count -eq 0) {
    throw 'No role specified. Example: -Roles 12 or -Roles 1,2'
  }
  return $unique
}

$root = Resolve-BuilderRoot
$src = Join-Path $root 'extension-src'
$roleItems = Normalize-Roles $Roles
$roleInts = @($roleItems | ForEach-Object { [int]$_ } | Sort-Object -Unique)

$manifestPath = Join-Path $src 'manifest.json'
$manifest = Get-Content -Path $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$baseVersion = [string]$manifest.version
$outVersion = if (-not [string]::IsNullOrWhiteSpace($Version)) { $Version.Trim() } else { $baseVersion }

$roleToken = ($roleInts | ForEach-Object { "r$_" }) -join '-'
$displayToken = if ($DisabledRoleDisplay -eq 'disabled') { '-disabled' } else { '' }
$packageName = "jiuan-collector-v$outVersion-$roleToken$displayToken"

$buildRoot = Join-Path $root '.build'
$packageDir = Join-Path $buildRoot $packageName
$outDir = Join-Path $root $OutputDir
$zipPath = Join-Path $outDir "$packageName.zip"

if (Test-Path $packageDir) { Remove-Item -Path $packageDir -Recurse -Force }
if (-not (Test-Path $buildRoot)) { New-Item -ItemType Directory -Path $buildRoot | Out-Null }
New-Item -ItemType Directory -Path $packageDir | Out-Null
Copy-Item -Path (Join-Path $src '*') -Destination $packageDir -Recurse -Force

$configDir = Join-Path $packageDir 'config'
if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir | Out-Null }
$config = [ordered]@{ enabledRoles = $roleInts }
if ($DisabledRoleDisplay -eq 'disabled') {
  $config.disabledRoleDisplay = 'disabled'
}
$configJson = $config | ConvertTo-Json -Depth 8
Set-Content -Path (Join-Path $configDir 'collector-role.config.json') -Value $configJson -Encoding UTF8

if ($outVersion -ne $baseVersion) {
  $filesToPatch = @('manifest.json', 'dashboard.html', 'dashboard.js', 'service-worker.js', 'README.md', 'CHANGELOG.md')
  foreach ($relative in $filesToPatch) {
    $file = Join-Path $packageDir $relative
    if (Test-Path $file) {
      $text = Get-Content -Path $file -Raw -Encoding UTF8
      $text = $text.Replace($baseVersion, $outVersion)
      Set-Content -Path $file -Value $text -Encoding UTF8
    }
  }
}

if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
if (Test-Path $zipPath) { Remove-Item -Path $zipPath -Force }

Compress-Archive -Path (Join-Path $packageDir '*') -DestinationPath $zipPath -Force
Remove-Item -Path $packageDir -Recurse -Force

Write-Host "Build completed: $zipPath"
Write-Host "Enabled roles: $($roleInts -join ',')"
Write-Host "Disabled role display: $DisabledRoleDisplay"
