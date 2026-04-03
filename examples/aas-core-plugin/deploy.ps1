param(
  [Parameter(Mandatory = $true)]
  [string]$InstallRoot,

  [switch]$Global,

  [switch]$Force,

  [string]$Opencode = "opencode"
)

$ErrorActionPreference = "Stop"

function Run-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Body
  )

  Write-Host "==> $Name"
  & $Body
}

$src = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path -LiteralPath $src)) {
  throw "Plugin source not found: $src"
}

if (-not (Test-Path -LiteralPath $InstallRoot)) {
  New-Item -ItemType Directory -Path $InstallRoot | Out-Null
}

$dst = Join-Path $InstallRoot "plugins\aas-core-plugin"
if (-not (Test-Path -LiteralPath $dst)) {
  New-Item -ItemType Directory -Path $dst -Force | Out-Null
}

Run-Step -Name "Sync plugin files to install-root" -Body {
  $null = robocopy $src $dst /MIR /XD ".git" "node_modules" /XF "bun.lock" "pnpm-lock.yaml" "package-lock.json" "yarn.lock"
  if ($LASTEXITCODE -gt 7) {
    throw "robocopy failed with code $LASTEXITCODE"
  }
}

$argv = @("plugin", $dst)
if ($Global) {
  $argv += "--global"
}
if ($Force) {
  $argv += "--force"
}

Run-Step -Name "Install plugin into OpenCode config" -Body {
  & $Opencode @argv
  if ($LASTEXITCODE -ne 0) {
    throw "OpenCode plugin install failed with code $LASTEXITCODE"
  }
}

Write-Host ""
Write-Host "Plugin deployed and installed from: $dst"
