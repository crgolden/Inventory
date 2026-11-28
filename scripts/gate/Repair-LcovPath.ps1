$lcov = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'inventory.client\coverage\lcov.info'
if (-not (Test-Path -LiteralPath $lcov -PathType Leaf)) {
    Write-Host 'inventory.client/coverage/lcov.info missing'
    exit 1
}
(Get-Content -LiteralPath $lcov) -replace '\\', '/' | Set-Content -LiteralPath $lcov
exit 0
