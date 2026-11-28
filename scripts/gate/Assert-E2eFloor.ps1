$client = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'inventory.client'
$results = Join-Path $client 'playwright-results.xml'
if (-not (Test-Path -LiteralPath $results -PathType Leaf)) {
    Write-Host 'inventory.client/playwright-results.xml missing'
    exit 1
}
$floor = [int](Get-Content -LiteralPath (Join-Path $client 'e2e\e2e-settings.json') -Raw | ConvertFrom-Json).executedTestFloor
$suites = ([xml](Get-Content -LiteralPath $results -Raw)).testsuites
$tests = [int]$suites.tests
$skipped = [int]$suites.skipped
$executed = $tests - $skipped
Write-Host "executed $executed (tests $tests, skipped $skipped), floor $floor"
if ($floor -le 0 -or $executed -lt $floor) { exit 1 }
exit 0
