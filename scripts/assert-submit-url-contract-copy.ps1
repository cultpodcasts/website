<#
.SYNOPSIS
  Fails unless website/cultpodcasts/src/app/submit-url-contract.ts matches Api/tests/fixtures/submit-url-contract.ts.

.DESCRIPTION
  The API case table is canonical. The website file must be a byte-identical copy.
  Skips (exit 0) when the sibling Api repo is not present.

  Usage (from website git root or cultpodcasts/):
    pwsh ./scripts/assert-submit-url-contract-copy.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$websiteRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$copyPath = Join-Path $websiteRoot 'cultpodcasts\src\app\submit-url-contract.ts'
$apiPath = Join-Path $websiteRoot '..\Api\tests\fixtures\submit-url-contract.ts'

if (-not (Test-Path -LiteralPath $copyPath)) {
    Write-Host "Missing website copy: $copyPath"
    exit 1
}

if (-not (Test-Path -LiteralPath $apiPath)) {
    Write-Host "Sibling Api fixture not found; skip copy check."
    exit 0
}

$left = Get-FileHash -LiteralPath $copyPath -Algorithm SHA256
$right = Get-FileHash -LiteralPath $apiPath -Algorithm SHA256
if ($left.Hash -ne $right.Hash) {
    Write-Host 'submit-url-contract.ts copies differ. Copy from Api/tests/fixtures/submit-url-contract.ts'
    Write-Host " website: $($left.Hash)"
    Write-Host " Api:     $($right.Hash)"
    exit 1
}

Write-Host "submit-url-contract.ts copies match ($($left.Hash.Substring(0, 12))…)."
