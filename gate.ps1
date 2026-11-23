param([string]$Goal, [string]$Only)

$ErrorActionPreference = 'Continue'
$gateCommon = $env:GATE_LIBRARY
if (-not $gateCommon -or -not (Test-Path -LiteralPath $gateCommon -PathType Leaf)) {
    Write-Host 'GATE: FAILED (GATE_LIBRARY names no gate library script; README.md, section Gate, says how to plug one in or run the steps without one)'
    exit 1
}
. $gateCommon
$gateOutput = if (Get-Command Get-GateOutputDirectory -ErrorAction SilentlyContinue) {
    Get-GateOutputDirectory (Split-Path -Leaf $PSScriptRoot)
} else {
    (New-Item -ItemType Directory -Force -Path (Join-Path ([IO.Path]::GetTempPath()) "claude\crgolden-gates\$(Split-Path -Leaf $PSScriptRoot)")).FullName
}

Register-GateStep @('node_modules install markers', 'Restore local tools',
    'npm run lint', 'npm run typecheck:e2e', 'npm run typecheck:spec', 'npm run lint:css', 'npm run audit', 'Begin Sonar analysis', 'Build with dotnet',
    'jb inspectcode', 'Run unit tests with coverage', 'Install Playwright browsers', 'Run UI tests',
    'Fix LCOV paths', 'Run browser E2E tests', 'Browser E2E executed at least its floor', 'Publish command reaches the CLI',
    'npm run lint:utilities', 'End Sonar analysis', 'Fail on open Sonar issues')
Register-StepInput 'node_modules install markers' @('*')
Register-StepInput 'Restore local tools' @('dotnet-tools.json')
Register-StepInput 'npm run lint' @('inventory.client/src/*', 'inventory.client/*.ts', 'inventory.client/*.mts', 'inventory.client/*.js', 'inventory.client/*.mjs', 'inventory.client/*.cjs', 'inventory.client/eslint-sonar.rules.json', 'inventory.client/angular.json', 'inventory.client/tsconfig*.json', 'inventory.client/package.json', 'inventory.client/package-lock.json')
Register-StepInput 'npm run typecheck:e2e' @('inventory.client/src/*', 'inventory.client/e2e/*', 'inventory.client/playwright.config.ts', 'inventory.client/tsconfig*.json', 'inventory.client/package.json', 'inventory.client/package-lock.json')
Register-StepInput 'npm run typecheck:spec' @('inventory.client/src/*', 'inventory.client/tsconfig*.json', 'inventory.client/package.json', 'inventory.client/package-lock.json')
Register-StepInput 'npm run lint:css' @('inventory.client/src/*', 'inventory.client/stylelint.config.mjs', 'inventory.client/package.json', 'inventory.client/package-lock.json', 'inventory.client/tools/stylelint/*')
Register-StepInput 'npm run audit' @('inventory.client/package.json', 'inventory.client/package-lock.json')
Register-StepInput 'Begin Sonar analysis' @('*')
Register-StepInput 'Build with dotnet' @('*')
Register-StepInput 'jb inspectcode' @('*')
Register-StepInput 'Run unit tests with coverage' @('*', '!inventory.client/e2e/*', '!inventory.client/src/*.spec.ts')
Register-StepInput 'Install Playwright browsers' @('*')
Register-StepInput 'Run UI tests' @('*', '!Inventory.Tests.Unit/*', '!inventory.client/e2e/*')
Register-StepInput 'Fix LCOV paths' @('*', '!Inventory.Tests.Unit/*', '!inventory.client/e2e/*')
Register-StepInput 'Run browser E2E tests' @('*', '!Inventory.Tests.Unit/*', '!inventory.client/src/*.spec.ts')
Register-StepInput 'Browser E2E executed at least its floor' @('*', '!Inventory.Tests.Unit/*', '!inventory.client/src/*.spec.ts')
Register-StepInput 'Publish command reaches the CLI' @('*')
Register-StepInput 'npm run lint:utilities' @('*')
Register-StepInput 'End Sonar analysis' @('*')
Register-StepInput 'Fail on open Sonar issues' @('*')
Register-VolatileStep @('npm run audit')
$repo = $PSScriptRoot
$client = Join-Path $repo 'inventory.client'
$scratch = $gateOutput
$sarif = Join-Path $scratch 'inventory-inspect.sarif'
$unitTrx = Join-Path $repo 'Inventory.Tests.Unit\bin\Release\net11.0\TestResults\unit-tests.trx'
$sonarBranch = Get-SonarBranchName
$beginSonar = "Begin Sonar analysis (branch $sonarBranch)"
$build = 'Build with dotnet (Release, AngularConfiguration=ci, RestoreLockedMode)'
$endSonar = 'End Sonar analysis (quality gate waited)'
$sonarIssues = 'Fail on open Sonar issues'
$unitStep = 'Run unit tests with coverage (Category=Unit)'
$uiStep = 'Run UI tests (npx --no -- vitest run --coverage)'
$env:TZ = 'UTC'
$env:CI = 'true'
if ($env:TZ -ne 'UTC') { Write-Host 'GATE: FAILED (TZ pin)'; exit 1 }
Set-Location $repo
$probeRoots = @('Inventory.Tests.Unit/', 'inventory.client/src/', 'inventory.client/e2e/')
if ($Only) {
    $probeFile, $probeTest = $Only -split '::', 2
    $probeFile = "$probeFile".Trim().Replace('\', '/')
    $probeTest = "$probeTest".Trim()
    $probeRoot = $probeRoots | Where-Object { $probeFile.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1
    if (-not $probeTest -or $probeTest.Contains(',') -or -not $probeRoot -or
            -not (Test-Path -LiteralPath (Join-Path $repo $probeFile) -PathType Leaf)) {
        Write-Host "PROBE: FAILED (a probe runs exactly one test, named by the file it lives in: -Only '<a test file under $($probeRoots -join ' | ')>::<the test's name>')"
        exit 1
    }
    $probeReport = Join-Path $gateOutput 'probe-report'
    Write-Host "PROBE: running one test, '$probeTest' of $probeFile; no gate record or verdict is written"
    $global:LASTEXITCODE = $null
    if ($probeRoot -eq $probeRoots[0]) {
        $probeClass = [IO.Path]::GetFileNameWithoutExtension($probeFile)
        $probeTrx = Join-Path $probeReport 'probe.trx'
        if (Test-Path -LiteralPath $probeTrx) { Remove-Item -LiteralPath $probeTrx -Force }
        dotnet test --project Inventory.Tests.Unit --configuration Release -- --filter-query "/*/*/$probeClass/$probeTest" --report-xunit-trx --report-xunit-trx-filename probe.trx --results-directory=$probeReport
        $probeExit = $global:LASTEXITCODE
        if (-not (Test-Path -LiteralPath $probeTrx)) { Write-Host "PROBE: FAILED (no TRX, exit $probeExit)"; exit 1 }
        $counters = ([xml](Get-Content -LiteralPath $probeTrx -Raw)).TestRun.ResultSummary.Counters
        $passed = [int]$counters.passed
        $failed = [int]$counters.failed
    }
    else {
        $probeJson = Join-Path $gateOutput 'probe-report.json'
        if (Test-Path -LiteralPath $probeJson) { Remove-Item -LiteralPath $probeJson -Force }
        Set-Location $client
        $clientFile = $probeFile.Substring('inventory.client/'.Length)
        if ($probeRoot -eq $probeRoots[1]) {
            npx --no -- vitest run $clientFile --coverage.enabled=false --reporter=json --outputFile="$probeJson" -t $probeTest
            $probeExit = $global:LASTEXITCODE
            if (-not (Test-Path -LiteralPath $probeJson)) { Write-Host "PROBE: FAILED (no JSON report, exit $probeExit)"; exit 1 }
            $report = Get-Content -LiteralPath $probeJson -Raw | ConvertFrom-Json
            $passed = [int]$report.numPassedTests
            $failed = [int]$report.numFailedTests
        }
        else {
            $env:PLAYWRIGHT_JSON_OUTPUT_NAME = $probeJson
            npx --no -- bddgen
            npx --no -- playwright test --project=chromium --no-deps --reporter=json --grep $probeTest
            $probeExit = $global:LASTEXITCODE
            Remove-Item Env:PLAYWRIGHT_JSON_OUTPUT_NAME -ErrorAction SilentlyContinue
            if (-not (Test-Path -LiteralPath $probeJson)) { Write-Host "PROBE: FAILED (no JSON report, exit $probeExit)"; exit 1 }
            $report = Get-Content -LiteralPath $probeJson -Raw | ConvertFrom-Json
            $passed = [int]$report.stats.expected
            $failed = [int]$report.stats.unexpected
        }
        Set-Location $repo
    }
    if ($probeExit -ne 0 -or $passed -ne 1 -or $failed -ne 0) {
        Write-Host "PROBE: FAILED (a probe runs one test, and '$probeTest' passed $passed, failed $failed, exit $probeExit)"
        exit 1
    }
    Write-Host 'PROBE: PASSED for the one test named, against the last build; no verdict was saved'
    exit 0
}
exit (Invoke-Gate {
Initialize-GateState 'Inventory' $repo
Get-OwedStep | Register-OwedStep
Invoke-GateLibraryStep

$markers = 'node_modules install markers'
Invoke-GateStep -Name $markers -Always -Body {
    $installed = (Test-Path (Join-Path $client 'node_modules\.package-lock.json')) -and
        (Test-Path (Join-Path $client 'node_modules\ajv')) -and (Test-Path (Join-Path $client 'node_modules\.bin\tsc.cmd'))
    if (-not $installed) { Stop-Gate $markers 'incomplete install; run npm ci deliberately first' }
    Assert-NodeInstallCurrent $client
    Write-Row $markers 'PASS' 'ajv, tsc.cmd present; every package matches package-lock.json'
}

$restore = 'Restore local tools (dotnet tool restore)'
Invoke-GateStep -Name $restore -Body {
    $global:LASTEXITCODE = $null
    dotnet tool restore
    Assert-StepExit $restore
}

Set-Location $client
Invoke-GateStep -Name 'npm run lint' -Needs @($markers) -Body {
    $global:LASTEXITCODE = $null
    npm run lint
    Assert-StepExit 'npm run lint'
}
Invoke-GateStep -Name 'npm run typecheck:e2e' -Needs @($markers) -Body {
    $global:LASTEXITCODE = $null
    npm run typecheck:e2e
    Assert-StepExit 'npm run typecheck:e2e'
}
Invoke-GateStep -Name 'npm run typecheck:spec' -Needs @($markers) -Body {
    $global:LASTEXITCODE = $null
    npm run typecheck:spec
    Assert-StepExit 'npm run typecheck:spec'
}
Invoke-GateStep -Name 'npm run lint:css' -Needs @($markers) -Body {
    $global:LASTEXITCODE = $null
    npm run lint:css
    Assert-StepExit 'npm run lint:css'
}
Invoke-GateStep -Name 'npm run audit' -Needs @($markers) -Body {
    $global:LASTEXITCODE = $null
    npm run audit
    Assert-StepExit 'npm run audit'
}
Set-Location $repo

$sonarCarried = Test-StepCarried $sonarIssues
if ($sonarCarried) {
    $null = Test-StepCarried $beginSonar
    $null = Test-StepCarried $build
    $null = Test-StepCarried $endSonar
}
else {
    $sonarStartedAt = [DateTimeOffset]::UtcNow
    Invoke-GateStep -Name $beginSonar -Always -Body {
        $env:JAVA_HOME = Get-SonarScannerJavaHome $beginSonar
        $global:LASTEXITCODE = $null
        dotnet-sonarscanner begin /k:"crgolden_Inventory" /o:"crgolden" /d:sonar.host.url="https://sonarcloud.io" /d:sonar.cs.opencover.reportsPaths="coverage.opencover.xml" /d:sonar.javascript.lcov.reportPaths="coverage/lcov.info" /d:sonar.exclusions="**/bin/**,**/obj/**,**/node_modules/**,**/*.d.ts" /d:sonar.coverage.exclusions="inventory.client/e2e/**,inventory.client/src/test-setup*.ts,**/Program.cs,inventory.client/**/*.config.*,inventory.client/src/environments/**,inventory.client/src/main.ts,inventory.client/aspnetcore-https.js,inventory.client/start-os.js,gate.ps1" /d:sonar.test.inclusions="**/*.spec.ts" /d:sonar.qualitygate.wait=true /d:sonar.scanner.skipJreProvisioning=true /d:sonar.scm.use.blame.algorithm=GIT_NATIVE_BLAME /d:sonar.branch.name="$sonarBranch"
        Assert-StepExit $beginSonar
    }

    Invoke-GateStep -Name $build -Needs @($markers) -Always -Body {
        $global:LASTEXITCODE = $null
        dotnet build --no-incremental --configuration Release /p:AngularConfiguration=ci /p:RestoreLockedMode=true /nodeReuse:false -warnaserror
        Assert-StepExit $build
    }
}

Invoke-GateStep -Name 'jb inspectcode' -Needs @($build, $restore) -Body {
    if (Test-Path $sarif) { Remove-Item $sarif -Force }
    dotnet jb inspectcode "$repo\Inventory.slnx" --no-build -e=WARNING --caches-home="$(New-InspectCodeCache $gateOutput)" --output="$sarif" --exclude="**/coverage/**;**/dist/**;**/node_modules/**;**/bin/**;**/obj/**"
    Test-Sarif $sarif
}

Invoke-GateStep -Name $unitStep -Needs @($build, $restore) -Body {
    if (Test-Path $unitTrx) { Remove-Item $unitTrx -Force }
    $global:LASTEXITCODE = $null
    dotnet coverlet Inventory.Tests.Unit\bin\Release\net11.0 `
        --target "dotnet" `
        --targetargs "test --project Inventory.Tests.Unit --no-build --configuration Release -- --filter-trait Category=Unit --report-xunit-trx --report-xunit-trx-filename unit-tests.trx --results-directory=Inventory.Tests.Unit/bin/Release/net11.0/TestResults" `
        --format opencover --output "coverage.opencover.xml" `
        --skipautoprops --exclude-by-attribute GeneratedCodeAttribute --exclude-by-file "**/obj/**" `
        --exclude-by-file "**/Program.cs" --does-not-return-attribute DoesNotReturnAttribute --include "[Inventory.Server]*"
    Test-Trx $unitStep $unitTrx $global:LASTEXITCODE -floor 1
}

Set-Location $client
$playwright = 'Install Playwright browsers'
Invoke-GateStep -Name $playwright -Needs @($markers) -Always -Body {
    Install-PlaywrightBrowser $playwright { npx playwright install --dry-run chromium } { npm run playwright:install }
}

Invoke-GateStep -Name $uiStep -Needs @($markers, $playwright) -Body {
    $global:LASTEXITCODE = $null
    npx --no -- vitest run --coverage
    Assert-StepExit $uiStep
}

$lcovStep = 'Fix LCOV paths for SonarQube'
Invoke-GateStep -Name $lcovStep -Needs @($uiStep) -Body {
    $lcov = Join-Path $client 'coverage\lcov.info'
    if (-not (Test-Path $lcov)) { Stop-Gate $lcovStep 'coverage/lcov.info missing' }
    (Get-Content $lcov) -replace '\\', '/' | Set-Content $lcov
    Write-Row $lcovStep 'PASS' ''
}

$e2eStep = 'Run browser E2E tests (npm run e2e:ci, CI=true, mock dependencies)'
$floorStep = 'Browser E2E executed at least its floor'
$publishStep = 'Publish command reaches the CLI (the workflow line run without GITHUB_RUN_ID must fail on the run identity, not on usage)'
$results = Join-Path $client 'playwright-results.xml'
$e2eRun = @{ Ran = $false }
Invoke-GateStep -Name $e2eStep -Needs @($build, $markers, $playwright) -Body {
    $e2eRun.Ran = $true
    if (Test-Path $results) { Remove-Item $results -Force }
    $global:LASTEXITCODE = $null
    npm run e2e:ci
    Assert-StepExit $e2eStep
}
if ($e2eRun.Ran) {
    Invoke-GateStep -Name $floorStep -Always -Body {
        if (-not (Test-Path $results)) { Stop-Gate $floorStep 'playwright-results.xml missing' }
        $floor = [int](Get-Content (Join-Path $client 'e2e\e2e-settings.json') -Raw | ConvertFrom-Json).executedTestFloor
        $xml = [xml](Get-Content $results -Raw)
        $tests = [int]$xml.testsuites.tests
        $skipped = [int]$xml.testsuites.skipped
        $executed = $tests - $skipped
        if ($floor -le 0 -or $executed -lt $floor) { Stop-Gate $floorStep "executed $executed (tests $tests, skipped $skipped), floor $floor" }
        Write-Row $floorStep 'PASS' "executed $executed (tests $tests, skipped $skipped), floor $floor"
    }
}
elseif (@(Get-FailedStep -Step @($e2eStep)).Count) {
    Write-PrerequisiteUnreached -Step @($floorStep) -Failed @($e2eStep)
}
Invoke-GateStep -Name $publishStep -Needs @($e2eStep) -Body {
    Test-PublishCommandLine $publishStep (Join-Path $repo '.github\workflows\master_crgolden-inventory.yml') 'Inventory' $client `
        (Get-Content (Join-Path $client 'e2e\e2e-settings.json') -Raw | ConvertFrom-Json).cucumberMessagesFile
}
Invoke-GateStep -Name 'npm run lint:utilities' -Needs @($build) -Body {
    $global:LASTEXITCODE = $null
    npm run lint:utilities
    Assert-StepExit 'npm run lint:utilities'
}
Set-Location $repo

if (-not $sonarCarried) {
    Invoke-GateStep -Name $endSonar -Needs @($beginSonar, $build, $unitStep, $uiStep, $lcovStep, $e2eStep) -Always -Body {
        $global:LASTEXITCODE = $null
        dotnet-sonarscanner end
        Assert-StepExit $endSonar
    }
    Invoke-GateStep -Name $sonarIssues -Needs @($endSonar) -Always -Body {
        Assert-NoOpenSonarIssue $sonarIssues 'crgolden_Inventory' $sonarBranch $sonarStartedAt
    }
}

Write-Row 'Upload test results / Publish E2E scenario results / dotnet publish / upload artifact / deploy' 'NOT RUN' 'delivery steps, not checks'
Complete-Gate
})
