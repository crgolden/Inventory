@{
    Schema   = 1
    Repo     = 'Inventory'
    Workflow = '.github/workflows/master_crgolden-inventory.yml'
    Settings = 'inventory.client/e2e/e2e-settings.json'
    Sonar    = @{ ProjectKey = 'crgolden_Inventory' }
    Probe    = @{
        Kind                = 'dotnet'
        Projects            = @('Inventory.Tests.Unit')
        Roots               = @{ 'inventory.client/src/' = 'vitest'; 'inventory.client/e2e/' = 'playwright' }
        Folder              = 'inventory.client'
        PlaywrightArguments = @('--project=chromium', '--no-deps')
        Before              = @{ 'inventory.client/e2e/' = @('npx', '--no', '--', 'bddgen') }
    }
    Steps    = @(
        @{ Name = 'Regenerate lock files and push'; Delivery = $true }
        @{ Name = 'Install SonarQube Cloud scanner'; Tool = 'dotnet-sonarscanner'; Inputs = @('*') }
        @{ Name = 'Install npm dependencies'; NodeInstall = @('tsc', 'ng'); WorkingDirectory = 'inventory.client'; Inputs = @('*'); Always = $true }
        @{ Name = 'Restore local tools'; Run = @('dotnet', 'tool', 'restore'); Inputs = @('dotnet-tools.json'); Always = $true }
        @{
            Name             = 'Lint'
            Tier             = 'Fast'
            Run              = @('npm', 'run', 'lint')
            WorkingDirectory = 'inventory.client'
            Needs            = @('Install npm dependencies')
            Inputs           = @('inventory.client/src/*', 'inventory.client/*.ts', 'inventory.client/*.mts', 'inventory.client/*.js', 'inventory.client/*.mjs', 'inventory.client/*.cjs', 'inventory.client/eslint-sonar.rules.json', 'inventory.client/angular.json', 'inventory.client/tsconfig*.json', 'inventory.client/package.json', 'inventory.client/package-lock.json')
        }
        @{
            Name             = 'Type-check E2E specs'
            Tier             = 'Fast'
            Run              = @('npm', 'run', 'typecheck:e2e')
            WorkingDirectory = 'inventory.client'
            Needs            = @('Install npm dependencies')
            Inputs           = @('inventory.client/src/*', 'inventory.client/e2e/*', 'inventory.client/playwright.config.ts', 'inventory.client/tsconfig*.json', 'inventory.client/package.json', 'inventory.client/package-lock.json')
        }
        @{
            Name             = 'Type-check unit specs'
            Tier             = 'Fast'
            Run              = @('npm', 'run', 'typecheck:spec')
            WorkingDirectory = 'inventory.client'
            Needs            = @('Install npm dependencies')
            Inputs           = @('inventory.client/src/*', 'inventory.client/tsconfig*.json', 'inventory.client/package.json', 'inventory.client/package-lock.json')
        }
        @{
            Name             = 'Lint stylesheets'
            Tier             = 'Fast'
            Run              = @('npm', 'run', 'lint:css')
            WorkingDirectory = 'inventory.client'
            Needs            = @('Install npm dependencies')
            Inputs           = @('inventory.client/src/*', 'inventory.client/stylelint.config.mjs', 'inventory.client/package.json', 'inventory.client/package-lock.json', 'inventory.client/tools/stylelint/*')
        }
        @{
            Name             = 'Audit dependencies (fails on high or critical)'
            Run              = @('npm', 'run', 'audit')
            WorkingDirectory = 'inventory.client'
            Needs            = @('Install npm dependencies')
            Inputs           = @('inventory.client/package.json', 'inventory.client/package-lock.json')
            Volatile         = $true
        }
        @{
            Name   = 'Begin Sonar analysis'
            Sonar  = 'begin'
            Needs  = @('Install SonarQube Cloud scanner', 'Restore local tools')
            Inputs = @('*')
            Run    = @(
                'dotnet-sonarscanner', 'begin', '/k:{sonarProject}', '/o:crgolden', '/d:sonar.host.url=https://sonarcloud.io',
                '/d:sonar.cs.opencover.reportsPaths=coverage.opencover.xml',
                '/d:sonar.javascript.lcov.reportPaths=coverage/lcov.info',
                '/d:sonar.exclusions=**/bin/**,**/obj/**,**/node_modules/**,**/*.d.ts',
                '/d:sonar.coverage.exclusions=inventory.client/e2e/**,inventory.client/src/test-setup*.ts,**/Program.cs,inventory.client/**/*.config.*,inventory.client/src/environments/**,inventory.client/src/main.ts,inventory.client/aspnetcore-https.js,inventory.client/start-os.js,gate.ps1,gate.steps.psd1,scripts/gate/**',
                '/d:sonar.test.inclusions=**/*.spec.ts', '/d:sonar.qualitygate.wait=true', '/d:sonar.scanner.skipJreProvisioning=true',
                '/d:sonar.scm.use.blame.algorithm=GIT_NATIVE_BLAME', '/d:sonar.branch.name={sonarBranch}'
            )
        }
        @{
            Name   = 'Build with dotnet'
            Sonar  = 'build'
            Needs  = @('Install npm dependencies')
            Inputs = @('*')
            Run    = @('dotnet', 'build', '--no-incremental', '--configuration', 'Release', '/p:AngularConfiguration=e2e', '/p:RestoreLockedMode=true', '/nodeReuse:false', '-warnaserror')
        }
        @{
            Name   = 'ReSharper inspection (jb inspectcode)'
            Needs  = @('Build with dotnet', 'Restore local tools')
            Inputs = @('*')
            Remove = @('{output}\inventory-inspect.sarif')
            Run    = @('dotnet', 'jb', 'inspectcode', 'Inventory.slnx', '--no-build', '-e=WARNING', '--caches-home={inspectCache}', '--output={output}\inventory-inspect.sarif', '--exclude=**/coverage/**;**/dist/**;**/node_modules/**;**/bin/**;**/obj/**')
            Check  = @{ Sarif = '{output}\inventory-inspect.sarif' }
        }
        @{
            Name   = 'Run unit tests with coverage'
            Needs  = @('Build with dotnet', 'Restore local tools')
            Inputs = @('*', '!inventory.client/e2e/*', '!inventory.client/src/*.spec.ts')
            Remove = @('Inventory.Tests.Unit\bin\Release\net11.0\TestResults\unit-tests.trx')
            Run    = @(
                'dotnet', 'coverlet', 'Inventory.Tests.Unit/bin/Release/net11.0', '--target', 'dotnet',
                '--targetargs', 'test --project Inventory.Tests.Unit --no-build --configuration Release -- --filter-trait Category=Unit --report-xunit-trx --report-xunit-trx-filename unit-tests.trx --results-directory=Inventory.Tests.Unit/bin/Release/net11.0/TestResults',
                '--format', 'opencover', '--output', 'coverage.opencover.xml', '--skipautoprops',
                '--exclude-by-attribute', 'GeneratedCodeAttribute', '--exclude-by-file', '**/obj/**', '--exclude-by-file', '**/Program.cs',
                '--does-not-return-attribute', 'DoesNotReturnAttribute', '--include', '[Inventory.Server]*'
            )
            Check  = @{ Trx = 'Inventory.Tests.Unit\bin\Release\net11.0\TestResults\unit-tests.trx'; Floor = 1 }
        }
        @{ Name = 'Get Playwright version'; Delivery = $true }
        @{
            Name              = 'Install Playwright browsers'
            PlaywrightInstall = @{ DryRun = @('npx', 'playwright', 'install', '--dry-run', 'chromium'); Install = @('npm', 'run', 'playwright:install') }
            WorkingDirectory  = 'inventory.client'
            Needs             = @('Install npm dependencies')
            Inputs            = @('*')
            Always            = $true
        }
        @{
            Name             = 'Run UI tests'
            Run              = @('npx', '--no', '--', 'vitest', 'run', '--coverage')
            WorkingDirectory = 'inventory.client'
            Needs            = @('Install npm dependencies', 'Install Playwright browsers')
            Inputs           = @('*', '!Inventory.Tests.Unit/*', '!inventory.client/e2e/*')
        }
        @{
            Name   = 'Fix LCOV paths for SonarQube'
            Run    = @('pwsh', '-NoProfile', '-File', 'scripts/gate/Repair-LcovPath.ps1')
            Needs  = @('Run UI tests')
            Inputs = @('*', '!Inventory.Tests.Unit/*', '!inventory.client/e2e/*')
        }
        @{
            Name     = 'Create the HTTPS development certificate'
            Run      = @('dotnet', 'dev-certs', 'https')
            Inputs   = @('*')
            Volatile = $true
        }
        @{
            Name             = 'Run browser E2E tests'
            Run              = @('npm', 'run', 'e2e')
            WorkingDirectory = 'inventory.client'
            Remove           = @('inventory.client\playwright-results.xml')
            Needs            = @('Build with dotnet', 'Install npm dependencies', 'Install Playwright browsers', 'Create the HTTPS development certificate')
            Inputs           = @('*', '!Inventory.Tests.Unit/*', '!inventory.client/src/*.spec.ts')
        }
        @{
            Name   = 'Assert browser E2E executed at least its floor'
            Run    = @('pwsh', '-NoProfile', '-File', 'scripts/gate/Assert-E2eFloor.ps1')
            Needs  = @('Run browser E2E tests')
            Inputs = @('*', '!Inventory.Tests.Unit/*', '!inventory.client/src/*.spec.ts')
        }
        @{
            Name             = 'Publish E2E scenario results'
            PublishCommand   = @{ App = 'Inventory'; Messages = '{setting:cucumberMessagesFile}' }
            WorkingDirectory = 'inventory.client'
            Needs            = @('Run browser E2E tests')
            Inputs           = @('*')
        }
        @{
            Name             = 'Check template classes against the built CSS'
            Run              = @('npm', 'run', 'lint:utilities')
            WorkingDirectory = 'inventory.client'
            Needs            = @('Build with dotnet')
            Inputs           = @('*')
        }
        @{ Name = 'dotnet publish'; Delivery = $true }
        @{ Name = 'End Sonar analysis'; Sonar = 'end'; Needs = @('Begin Sonar analysis', 'Build with dotnet'); Inputs = @('*'); Run = @('dotnet-sonarscanner', 'end') }
        @{ Name = 'Fail on open Sonar issues'; Sonar = 'issues'; Needs = @('End Sonar analysis'); Inputs = @('*') }
        @{ Name = 'Run the app on .NET 11'; Delivery = $true }
    )
}
