<#
.SYNOPSIS
  Fails unless website streaming-submit-contract.ts matches Api fixture.

.DESCRIPTION
  Api/tests/fixtures/streaming-submit-contract.ts is canonical.
  Skips (exit 0) when the sibling Api repo is not present.

  Usage (from website git root):
    pwsh ./scripts/assert-streaming-submit-contract-copy.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$websiteRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$copyPath = Join-Path $websiteRoot 'cultpodcasts\src\app\streaming-submit-contract.ts'
$apiPath = Join-Path $websiteRoot '..\Api\tests\fixtures\streaming-submit-contract.ts'

if (-not (Test-Path -LiteralPath $copyPath)) {
    Write-Host "Missing website copy: $copyPath"
    exit 1
}

if (-not (Test-Path -LiteralPath $apiPath)) {
    Write-Host "Sibling Api fixture not found; skip streaming-submit contract copy check."
    exit 0
}

$left = Get-FileHash -LiteralPath $copyPath -Algorithm SHA256
$right = Get-FileHash -LiteralPath $apiPath -Algorithm SHA256
if ($left.Hash -ne $right.Hash) {
    Write-Host 'streaming-submit-contract.ts copies differ. Copy from Api/tests/fixtures/streaming-submit-contract.ts'
    Write-Host " website: $($left.Hash)"
    Write-Host " Api:     $($right.Hash)"
    exit 1
}

Write-Host "streaming-submit-contract.ts copies match ($($left.Hash.Substring(0, 12))…)."
