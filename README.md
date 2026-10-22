# Inventory

[![Build and deploy ASP.Net Core app to Azure Web App - crgolden-inventory](https://github.com/crgolden/Inventory/actions/workflows/master_crgolden-inventory.yml/badge.svg)](https://github.com/crgolden/Inventory/actions/workflows/master_crgolden-inventory.yml)

[![Quality gate](https://sonarcloud.io/api/project_badges/quality_gate?project=crgolden_Inventory)](https://sonarcloud.io/summary/new_code?id=crgolden_Inventory)

Keep a private list of the products you own, browse a shared public catalog of those products, and find a
product's manual through an AI chat. An **Angular 22** single-page app served by an **ASP.NET Core 10**
Backend-for-Frontend built on [Duende BFF](https://docs.duendesoftware.com/bff/): the BFF holds the OIDC session and
every token, and proxies the app's calls to a Products API (OData) and a Manuals API (chat).

How the parts fit together, sign-in, the pages and the invariants: [ARCHITECTURE.md](ARCHITECTURE.md). The visual
design rules: [DESIGN.md](DESIGN.md). Every test tier and how to run it: [TESTING.md](TESTING.md).

## Technologies

| Layer | Technology |
|---|---|
| Server | .NET 10 (`global.json`), ASP.NET Core, Duende BFF 4 (`Duende.BFF.Yarp`) |
| Client | Angular 22, zoneless, signals; Tailwind CSS v4; Node.js 24 (`inventory.client/.nvmrc`) |
| Shared packages | the `Shared` NuGet package and the `@crgolden/modules` npm package, both from GitHub Packages |
| Observability (production) | OpenTelemetry over OTLP; Serilog to Elasticsearch |
| Tests | xUnit v3, Vitest (jsdom and browser mode), Playwright with `playwright-bdd`, SonarCloud, ReSharper `jb inspectcode` |
| Hosting | Azure App Service; Key Vault references; data-protection keys in Blob Storage |

## Prerequisites

- The .NET 10 SDK and Node.js 24.
- A GitHub personal access token with the `read:packages` scope. `NuGet.Config` and `inventory.client/.npmrc` read
  the `crgolden` GitHub Packages feed, which asks for a token even for a public package, and `dotnet build` runs
  `npm install` for the client. Store it outside the repo, for NuGet and for npm:

  ```powershell
  dotnet nuget update source GitHub --username <your GitHub user> --password <token> --store-password-in-clear-text --configfile "$env:APPDATA\NuGet\NuGet.Config"
  ```

  and in your user `~/.npmrc`: `//npm.pkg.github.com/:_authToken=<token>`.
- A trusted ASP.NET Core development certificate (`dotnet dev-certs https --trust`); the client dev server serves
  HTTPS with it.
- To run the tests: nothing else. The E2E tier, with `CI` set, starts its own mock OIDC provider, Products and
  Manuals servers.
- To sign in to a running copy: an OIDC provider with a confidential client for this app (redirect
  `<origin>/signin-oidc`, scopes `offline_access openid profile email phone address manuals products`), and the
  Products and Manuals APIs.

## Clone and build

```powershell
git clone https://github.com/crgolden/Inventory.git
cd Inventory
dotnet tool restore
dotnet build
```

`dotnet build` installs the client's npm dependencies and builds it too.

## Configuration

Settings come from `appsettings*.json`, then User Secrets in Development (id `5480cab8-b41b-4dae-8c41-dbc2c01a15e0`),
then environment variables. A missing required setting stops the app at startup.

| Setting | Required | Purpose |
|---|---|---|
| `OidcAuthority`, `InventoryClientId`, `InventoryClientSecret` | always | the OIDC client |
| `ProductsApiAddress`, `ManualsApiAddress` | always | where `/products/api/**`, `/catalog/api/**` and `/manuals/api/**` go |
| `OpenIdConnectOptions` section | always (in `appsettings.json`) | response type and mode, scopes, claim mapping; `ResponseType` must be `code` |
| `DefaultAzureCredentialOptions`, `BlobUri`, `DataProtectionKeyIdentifier`, `ElasticsearchNode`, `ElasticsearchUsername`, `ElasticsearchPassword`, `AlloyEndpoint` | Production only | managed identity, data protection, logs, traces and metrics |

`appsettings.Development.json` points the OIDC authority and both APIs at local addresses; set the client id and
secret as User Secrets:

```powershell
dotnet user-secrets set InventoryClientId "<client id>" --project Inventory.Server
dotnet user-secrets set InventoryClientSecret "<client secret>" --project Inventory.Server
```

## Run locally

```powershell
dotnet run --project Inventory.Server        # the BFF, https://localhost:7150
cd inventory.client
npm start                                    # the client, https://localhost:50212
```

The client dev server proxies `/bff`, `/products/api`, `/catalog/api` and `/manuals/api` to the BFF
(`inventory.client/src/proxy.conf.json`). Visual Studio's `https` launch profile starts both together.

## Tests

```powershell
dotnet test --project Inventory.Tests.Unit -- --filter-trait "Category=Unit"
cd inventory.client
npx vitest run
```

Run Vitest from `inventory.client/`: its setup resolves the component templates from the working directory's `src`.

The browser E2E tier and the synthetic walker are in [TESTING.md](TESTING.md).

## Gate

`gate.ps1` is the maintainers' gate. It dot-sources the gate library script that the `GATE_LIBRARY` environment
variable names, which defines the step functions `gate.ps1` calls; unset, as in a plain clone, it stops at once with
`GATE: FAILED` and records nothing. To gate with a library of your own, set `GATE_LIBRARY` to its path; it must
define every function `gate.ps1` calls, since those functions decide whether each step ran and passed. To gate your own change without one, run the checks CI runs, in this order (the npm and `npx` steps from
`inventory.client/`, the `dotnet` steps from the repo root; set `CI=true` and `ASPNETCORE_ENVIRONMENT=CI` before
`e2e:ci` so the E2E tier uses its mocks):

```powershell
npm ci
npm run lint
npm run typecheck:e2e
npm run typecheck:spec
npm run lint:css
npm run audit
dotnet build --no-incremental --configuration Release /p:AngularConfiguration=ci /p:RestoreLockedMode=true -warnaserror
dotnet jb inspectcode Inventory.slnx --no-build -e=WARNING --output=inspectcode.sarif --exclude="**/coverage/**;**/dist/**;**/node_modules/**;**/bin/**;**/obj/**"
dotnet test --project Inventory.Tests.Unit --no-build --configuration Release -- --filter-trait "Category=Unit"
npm run playwright:install
npx vitest run --coverage
dotnet dev-certs https
npm run e2e:ci
npm run lint:utilities
```

Every command must exit 0, and `inspectcode.sarif` must hold no results. CI additionally runs a SonarCloud analysis
and fails on any open issue.

## Deployment

`.github/workflows/master_crgolden-inventory.yml` runs the checks above on every push and pull request; on `master`
it publishes the app and deploys it to Azure App Service over OIDC federated credentials. `synthetic.yml` walks the
deployed app on a schedule.

| Repository secret or variable | Used by |
|---|---|
| `PACKAGES_READ_TOKEN` (secret) | restoring from GitHub Packages |
| `SONAR_TOKEN` (secret); `SONAR_PROJECT_KEY`, `SONAR_ORGANIZATION` (variables) | the SonarCloud steps |
| `TEST_RESULTS_PGPASSWORD` (secret); `TEST_RESULTS_PGHOST`, `TEST_RESULTS_PGDATABASE`, `TEST_RESULTS_PGUSER`, `TEST_RESULTS_PGSSLMODE`, `TEST_RESULTS_APP` (variables) | publishing the E2E scenario results |
| `AZUREAPPSERVICE_CLIENTID_*`, `AZUREAPPSERVICE_TENANTID_*`, `AZUREAPPSERVICE_SUBSCRIPTIONID_*` | the deploy job |
