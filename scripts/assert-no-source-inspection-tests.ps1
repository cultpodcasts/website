<#
.SYNOPSIS
  Fails if Vitest/spec files read production TypeScript/JavaScript as text.

.DESCRIPTION
  Tests must import and execute production code. Reading *.ts / *.js via
  readFileSync to assert string contents is forbidden.
  Allowed: Sass, HTML fixtures, markdown docs, prerender lists, _routes.json.

  Usage (website git root):
    pwsh ./scripts/assert-no-source-inspection-tests.ps1
#>
[CmdletBinding()]
param(
    [string] $TestsRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
if (-not $TestsRoot) {
    $TestsRoot = Join-Path $repoRoot 'cultpodcasts'
}

$violations = [System.Collections.Generic.List[string]]::new()

$files = Get-ChildItem -LiteralPath $TestsRoot -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '\.(spec|test)\.(ts|js)$' }
foreach ($file in $files) {
    $lines = Get-Content -LiteralPath $file.FullName
    $rel = $file.FullName.Substring($repoRoot.Path.Length).TrimStart('\', '/')
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match 'readFileSync\s*\(' -or $line -match 'fs\.readFile(?:Sync)?\s*\(') {
            $window = ($lines[$i..([Math]::Min($i + 4, $lines.Count - 1))] -join ' ')
            if ($window -match '\.component\.ts|\.routes\.ts|server\.ts|main\.server\.ts' -or
                $window -match 'src[/\\].*\.(ts|js)["'']' -or
                ($window -match '\.ts["'']\s*,\s*["'']utf-?8' -and $window -notmatch '\.(sass|scss|html|md|json)')) {
                $violations.Add("${rel}:$($i + 1): $line".Trim()) | Out-Null
            }
        }
    }
}

if ($violations.Count -gt 0) {
    Write-Host 'Source-inspection tests are forbidden. Import and run production code instead.'
    $violations | ForEach-Object { Write-Host " - $_" }
    exit 1
}

Write-Host 'No production .ts/.js source-string tests found.'
