param([string]$Goal)

$ErrorActionPreference = 'Continue'
$gateCommon = Join-Path $PSScriptRoot '..\Tools\Gates\GateCommon.ps1'
if (-not (Test-Path -LiteralPath $gateCommon)) {
    Write-Host "GATE: FAILED (the Tools repository must be cloned beside this one: $gateCommon)"
    exit 1
}
. $gateCommon
$gateOutput = Join-Path ([IO.Path]::GetTempPath()) "crgolden-gates\$(Split-Path -Leaf $PSScriptRoot)"
New-Item -ItemType Directory -Force -Path $gateOutput | Out-Null
$GateDelta = @('plant:inventory.client/src/zz-bail-plant.spec.ts')

Register-GateSteps @('node_modules install markers', 'Restore local tools',
    'npm run lint', 'npm run typecheck:e2e', 'npm run typecheck:spec', 'npm run lint:css', 'Begin Sonar analysis', 'Build with dotnet',
    'jb inspectcode', 'Run unit tests with coverage', 'Run UI tests', 'Vitest bail plant', 'Fix LCOV paths',
    'Install browser E2E Playwright browsers', 'Run browser E2E tests', 'Browser E2E executed a nonzero test count',
    'npm run lint:utilities', 'End Sonar analysis')
$repo = $PSScriptRoot
$client = Join-Path $repo 'inventory.client'
$scratch = $gateOutput
$sarif = Join-Path $scratch 'inventory-inspect.sarif'
$bailReport = Join-Path $scratch 'inventory-bail-plant.json'
$plant = Join-Path $client 'src\zz-bail-plant.spec.ts'
$plantedFailures = 3
$unitTrx = Join-Path $repo 'Inventory.Tests.Unit\bin\Release\net10.0\TestResults\unit-tests.trx'
$sonarBranch = "branch-local-$($env:COMPUTERNAME.ToLowerInvariant())"
$beginSonar = "Begin Sonar analysis (branch $sonarBranch)"
$build = 'Build with dotnet (Release, AngularConfiguration=ci, RestoreLockedMode)'
$endSonar = 'End Sonar analysis (quality gate waited)'
$unitStep = 'Run unit tests with coverage (Category=Unit)'
$uiStep = 'Run UI tests (npx vitest run --coverage)'
$env:TZ = 'UTC'
$env:CI = 'true'
if ($env:TZ -ne 'UTC') { Write-Host 'GATE: FAILED (TZ pin)'; exit 1 }
Set-Location $repo
Initialize-GateState 'Inventory' $repo
Invoke-CatalogSteps

$installed = (Test-Path (Join-Path $client 'node_modules\.package-lock.json')) -and
    (Test-Path (Join-Path $client 'node_modules\ajv')) -and (Test-Path (Join-Path $client 'node_modules\.bin\tsc.cmd'))
if (-not $installed) { Stop-Gate 'node_modules install markers' 'incomplete install; run npm ci deliberately first' }
Write-Row 'node_modules install markers' 'PASS' '.package-lock.json, ajv, tsc.cmd present'

$global:LASTEXITCODE = $null
dotnet tool restore
$null = Test-Exit 'Restore local tools (dotnet tool restore)'

Set-Location $client
if (-not (Test-StepCarried 'npm run lint')) {
    $global:LASTEXITCODE = $null
    npm run lint
    $null = Test-Exit 'npm run lint'
}
if (-not (Test-StepCarried 'npm run typecheck:e2e')) {
    $global:LASTEXITCODE = $null
    npm run typecheck:e2e
    $null = Test-Exit 'npm run typecheck:e2e'
}
if (-not (Test-StepCarried 'npm run typecheck:spec')) {
    $global:LASTEXITCODE = $null
    npm run typecheck:spec
    $null = Test-Exit 'npm run typecheck:spec'
}
if (-not (Test-StepCarried 'npm run lint:css')) {
    $global:LASTEXITCODE = $null
    npm run lint:css
    $null = Test-Exit 'npm run lint:css'
}
Set-Location $repo

$sonarCarried = Test-StepCarried $endSonar
if ($sonarCarried) {
    $null = Test-StepCarried $beginSonar
    $null = Test-StepCarried $build
}
else {
    $env:JAVA_HOME = "$env:SystemDrive\sonar-scanner-8.0.1.6346-windows-x64\jre"
    $global:LASTEXITCODE = $null
    dotnet-sonarscanner begin /k:"crgolden_Inventory" /o:"crgolden" /d:sonar.token="$env:SONAR_TOKEN" /d:sonar.host.url="https://sonarcloud.io" /d:sonar.cs.opencover.reportsPaths="coverage.opencover.xml" /d:sonar.javascript.lcov.reportPaths="coverage/lcov.info" /d:sonar.exclusions="**/bin/**,**/obj/**,**/node_modules/**,**/*.d.ts" /d:sonar.coverage.exclusions="inventory.client/e2e/**,inventory.client/src/test-setup.ts,**/Program.cs,inventory.client/**/*.config.*,inventory.client/src/environments/**,inventory.client/src/main.ts,inventory.client/aspnetcore-https.js,inventory.client/start-os.js" /d:sonar.test.inclusions="**/*.spec.ts" /d:sonar.qualitygate.wait=true /d:sonar.scanner.skipJreProvisioning=true /d:sonar.branch.name="$sonarBranch"
    $null = Test-Exit $beginSonar

    $global:LASTEXITCODE = $null
    dotnet build --no-incremental --configuration Release /p:AngularConfiguration=ci /p:RestoreLockedMode=true /nodeReuse:false -warnaserror
    $null = Test-Exit $build
}

if (-not (Test-StepCarried 'jb inspectcode')) {
    if (Test-Path $sarif) { Remove-Item $sarif -Force }
    dotnet jb inspectcode "$repo\Inventory.slnx" --no-build -e=WARNING --output="$sarif" --exclude="**/coverage/**;**/dist/**;**/node_modules/**;**/bin/**;**/obj/**"
    Test-Sarif $sarif
}

if (-not (Test-StepCarried $unitStep)) {
    if (Test-Path $unitTrx) { Remove-Item $unitTrx -Force }
    $global:LASTEXITCODE = $null
    dotnet coverlet Inventory.Tests.Unit\bin\Release\net10.0 `
        --target "dotnet" `
        --targetargs "test --project Inventory.Tests.Unit --no-build --configuration Release -- --filter-trait Category=Unit --stop-on-fail on --report-xunit-trx --report-xunit-trx-filename unit-tests.trx --results-directory=Inventory.Tests.Unit/bin/Release/net10.0/TestResults" `
        --format opencover --output "coverage.opencover.xml" `
        --skipautoprops --exclude-by-attribute GeneratedCodeAttribute --exclude-by-file "**/obj/**" `
        --exclude-by-file "**/Program.cs" --does-not-return-attribute DoesNotReturnAttribute --include "[Inventory.Server]*"
    Test-Trx $unitStep $unitTrx $global:LASTEXITCODE 1
}

Set-Location $client
if (-not (Test-StepCarried $uiStep)) {
    $global:LASTEXITCODE = $null
    npx vitest run --coverage
    $null = Test-Exit $uiStep
}

$plantStep = "Vitest bail plant ($plantedFailures failing tests planted, bail: 1 must stop the run before the second)"
if (-not (Test-StepCarried $plantStep)) {
    $cases = 1..$plantedFailures | ForEach-Object { "  it('planted failure $_', () => { expect(true).toBe(false); });" }
    Set-Content -Path $plant -Value (@("describe('bail plant', () => {") + $cases + @('});'))
    if (Test-Path $bailReport) { Remove-Item $bailReport -Force }
    try {
        $global:LASTEXITCODE = $null
        npx vitest run src/zz-bail-plant.spec.ts --coverage.enabled=false --reporter=json --outputFile="$bailReport"
        $plantExit = $global:LASTEXITCODE
    }
    finally { Remove-Item $plant -Force -ErrorAction SilentlyContinue }
    if (Test-Path $plant) { Stop-Gate $plantStep 'the plant file could not be removed' }
    if (-not (Test-Path $bailReport)) { Stop-Gate $plantStep "no JSON report (exit $plantExit): the plant did not run" }
    $report = Get-Content $bailReport -Raw | ConvertFrom-Json
    $detail = "exit $plantExit, collected $($report.numTotalTests), failed $($report.numFailedTests)"
    if ($report.numTotalTests -ne $plantedFailures) { Stop-Gate $plantStep "the plant did not apply: $detail" }
    if ($plantExit -eq 0 -or $report.numFailedTests -lt 1) { Stop-Gate $plantStep "the planted failures did not fail the run: $detail" }
    if ($report.numFailedTests -ge $plantedFailures) { Stop-Gate $plantStep "bail did not stop the run: $detail" }
    Write-Row $plantStep 'PASS' $detail
}

if (-not (Test-StepCarried 'Fix LCOV paths for SonarQube')) {
    $lcov = Join-Path $client 'coverage\lcov.info'
    if (-not (Test-Path $lcov)) { Stop-Gate 'Fix LCOV paths for SonarQube' 'coverage/lcov.info missing' }
    (Get-Content $lcov) -replace '\\', '/' | Set-Content $lcov
    Write-Row 'Fix LCOV paths for SonarQube' 'PASS' ''
}

$global:LASTEXITCODE = $null
npm run playwright:install
$null = Test-Exit 'Install browser E2E Playwright browsers'

$e2eStep = 'Run browser E2E tests (npm run e2e:ci, CI=true, mock dependencies)'
if (-not (Test-StepCarried $e2eStep)) {
    $results = Join-Path $client 'playwright-results.xml'
    if (Test-Path $results) { Remove-Item $results -Force }
    $env:ASPNETCORE_ENVIRONMENT = 'CI'
    $global:LASTEXITCODE = $null
    npm run e2e:ci
    $null = Test-Exit $e2eStep
    if (-not (Test-Path $results)) { Stop-Gate 'Browser E2E executed a nonzero test count' 'playwright-results.xml missing' }
    $xml = [xml](Get-Content $results -Raw)
    $tests = [int]$xml.testsuites.tests
    $skipped = [int]$xml.testsuites.skipped
    if ($tests -eq 0 -or $skipped -ge $tests) { Stop-Gate 'Browser E2E executed a nonzero test count' "tests $tests, skipped $skipped" }
    Write-Row 'Browser E2E executed a nonzero test count' 'PASS' "tests $tests, skipped $skipped"
}
if (-not (Test-StepCarried 'npm run lint:utilities')) {
    $global:LASTEXITCODE = $null
    npm run lint:utilities
    $null = Test-Exit 'npm run lint:utilities'
}
Set-Location $repo

if (-not $sonarCarried) {
    $global:LASTEXITCODE = $null
    dotnet-sonarscanner end /d:sonar.token="$env:SONAR_TOKEN"
    $null = Test-Exit $endSonar
}

Write-Row 'Upload test results / dotnet publish / upload artifact / deploy' 'NOT RUN' 'delivery steps, not checks'
Complete-Gate
