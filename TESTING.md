# Testing

The Inventory test suite is split across three tiers: **backend unit tests** (xUnit v3, `Inventory.Tests.Unit`), **frontend unit tests** (Vitest, `inventory.client/`), and **browser E2E tests** (Playwright, TypeScript, `inventory.client/e2e`).

**Browser testing here is TypeScript only, and that is a structural decision rather than a preference.** Inventory is the fleet's one .NET BFF: it serves the UI and owns no behavior of its own, so it has nothing for an API-integration tier to drive, and a .NET browser tier would only re-drive the same pages the TypeScript suite already drives. Identity keeps a .NET Playwright suite because Razor Pages leaves it nowhere else to put one; every other front end drives its browser from TypeScript.

Unit test coding standards (MockBehavior.Strict, argument verification, SetupSequence, no control-flow in tests, etc.) are in the workspace-level [Unit Test Standards](../AGENTS/TESTING.md#unit-test-standards). Note for Playwright E2E tests: a `for` or `foreach` is acceptable when it is test setup (e.g. sending N chat messages to prime state) rather than an assertion branch.

## Test tiers

| Tier | Trait / tool | Project | Requires Azure? | Requires Angular build? | Runs in CI |
|------|-------------|---------|-----------------|------------------------|------------|
| Backend unit | `Category=Unit` | `Inventory.Tests.Unit` | No | No | Every push/PR |
| Frontend unit | Vitest | `inventory.client` | No | No | Every push/PR |
| Browser E2E | Playwright (`--project=chromium`) | `inventory.client/e2e` | No. With `CI` set, the BFF signs in against a mock OIDC provider and proxies to mock Products and Manuals; without it, to the local services | Served by `npm start`, which `playwright.config.ts` launches | Every push/PR |
| Synthetic walker | Playwright (`--project=synthetic`) | `inventory.client/e2e/synthetic` | No — targets the deployed app directly | No | Scheduled only, never a merge gate |

**The `Category=Smoke` tier no longer exists.** It was a stopgap until synthetic walkers existed; once they did it
was duplicate coverage — the same product CRUD lifecycle, against the same deployed app, under the same account —
that additionally needed a reCAPTCHA exemption to log in and had no sweep for the rows it left behind. The walker
replaces it.

---

## Running tests locally

### Build configurations

`Inventory.Server.csproj` has two Angular build targets:

| MSBuild configuration | Angular build | When to use |
|---|---|---|
| `Debug` (default) | `ng build --configuration development` — no optimization, fast (~1 min) | Local development and local test runs |
| `Release` (default) | `ng build --configuration production` — AOT, minification, tree-shaking (~4–5 min) | Local production-bundle testing only |
| `Release /p:AngularConfiguration=ci` | `ng build --configuration ci` — same optimizations as `production` | CI build step |

The `BuildAngularRelease` target accepts `/p:AngularConfiguration=<name>` to select any Angular configuration defined in `angular.json`. The default for Release is `production`. CI explicitly passes `ci`; adding a staging environment requires only a new `environment.staging.ts`, a matching entry in `angular.json`, and `/p:AngularConfiguration=staging` in the pipeline.

Always use `--configuration Debug` for local test runs. There is no reason to pay the production build cost just to run tests — Playwright only needs the files to exist and load in a browser.

### Prerequisites

```powershell
cd inventory.client && npm ci        # install Angular dependencies (first time)
dotnet build --configuration Debug    # builds Angular (dev mode) + C# into bin/Debug/
```

No Azure credentials needed. `InventoryWebApplicationFactory` is a minimal static-file Kestrel server — no Azure Key Vault, no BFF, no `DefaultAzureCredential`. All API routes (`/bff/**`, `/products/api/**`, `/manuals/api/**`, `/catalog/api/**`) are Playwright route mocks in local E2E mode.

The Angular build output must exist at `inventory.client/dist/inventory.client/browser/` before running E2E tests. The test factory sets the Kestrel web root to that directory; if it is absent the server still starts but serves no static files.

For running tests (`dotnet test` from the repo root — never the workspace root), see the workspace-level [TESTING.md](../AGENTS/TESTING.md).

### Backend Unit Tests

```powershell
dotnet build Inventory.Tests.Unit --configuration Debug
.\Inventory.Tests.Unit\bin\Debug\net10.0\Inventory.Tests.Unit.exe -trait "Category=Unit" -showLiveOutput
```

Prefer `Debug` here. `Release` re-runs `ng build --configuration production` on every build because the
`BuildAngularRelease` target has no `Inputs`/`Outputs`; the `Debug` target does, so it no-ops when the
client is already built. That is three minutes per iteration against thirty seconds.

`Logging/DuendeLicenseNoticeTests.cs` covers the Serilog exclusion that keeps Duende BFF's unlicensed
notice out of Elasticsearch. Only one of its six tests asserts something is dropped; the other five
assert that the four sibling events from the same logger — `ErrorValidatingLicenseKey`,
`LicenseHasExpired`, `TrialModeWarning`, and a same-named event from any other logger — still get
through, and those are the ones that can fail. Widening the predicate to match the logger category
instead of the event turns four of the six red. Background: `AGENTS/REPOS/Inventory.md`.

### Frontend unit tests

```bash
cd inventory.client
npx vitest run           # one-shot
npx vitest run --coverage  # with LCOV coverage report → coverage/lcov.info
```

### Browser E2E tests

```bash
cd inventory.client
npm run playwright:install   # once per machine
npm run e2e:ci               # what CI runs: the chromium project only
npm run e2e:ui               # same suite, Playwright's UI mode, for debugging one spec
```

`playwright.config.ts` starts the BFF and the Angular server itself. **Set `SKIP_WEBSERVER=1` when they are
already running locally**, or the run waits on ports that are already held.

**With `CI` set the BFF starts from the Release build, never a fresh `dotnet run` build.** A Debug `dotnet run`
builds the `inventory.client.esproj` reference first, a full Angular development build, inside the web server's
60-second window; it overruns it and Playwright kills the half-built process before any test runs. `--no-build
--configuration Release` launches the binary CI's and the gate's own build step produced, so E2E also exercises
the exact artifact those steps verified.

With `CI` set (CI itself, and the local gate), `playwright.config.ts` also starts three mock servers from
`e2e/mocks/` and points the BFF at them; without it the BFF keeps its `appsettings.Development.json` targets, the local
Identity, Products and Manuals, and `auth.setup.ts` signs in by passkey, so that run needs `PASSKEY_CREDENTIAL3`. The
suite cleans up only through the UI: a journey that creates a product deletes it from the product list
(`deleteProductThroughTheList` in `e2e/ci-products.ts`) before it completes. The catalog row a product creates has no
delete lever in the UI, so against real services it stays.

### Run all tests in sequence

```powershell
dotnet build Inventory.Tests.Unit --configuration Debug
.\Inventory.Tests.Unit\bin\Debug\net10.0\Inventory.Tests.Unit.exe -showLiveOutput
cd inventory.client && npx vitest run --coverage && npm run e2e:ci
```

---

## E2E test infrastructure

```
playwright.config.ts
  ├── webServer (CI set only): node e2e/mocks/oidc-server.ts, products-server.ts, manuals-server.ts
  ├── webServer: dotnet run --project ../Inventory.Server   (https://localhost:7150; with CI set,
  │              --no-build --configuration Release, the build the gate's own step made)
  ├── webServer: npm start                                  (https://localhost:50212)
  ├── project "setup"     -> auth.setup.ts, sign-in through the BFF (mock OIDC with CI set, passkey without)
  ├── project "chromium"  -> everything but e2e/synthetic, reusing e2e/.auth/user.json
  └── project "synthetic" -> the scheduled walker, never a merge gate
```

**The BFF is the real SUT and everything it calls is a mock in CI.** The mocks are self-contained `node:http`
servers that Node 24 runs as TypeScript directly (`node e2e/mocks/<name>.ts`). Node resolves only a full file name, so
their relative imports carry the `.ts` extension and `tsconfig.e2e.json` sets `allowImportingTsExtensions`. Their ports and the switch live in
`e2e/mocks/mock-dependencies.ts`, read by the config, the mocks and `auth.setup.ts`. The BFF reaches them through its
ordinary configuration keys (`OidcAuthority`, `ProductsApiAddress`, `ManualsApiAddress`, a generated client id and
secret) and `OpenIdConnectOptions:RequireHttpsMetadata = false`, the one setting that lets it take a plain-HTTP
provider; production leaves it at its default, `true`.

### Authentication

With `CI` set, `auth.setup.ts` sets the mock provider's identity cookie and walks `/bff/login`: the BFF runs its real
OIDC code flow against the mock, which echoes the handler's `nonce`, signs the id token with its own JWKS key and answers
`prompt=none` with `error=login_required` when no identity cookie is present, so the silent-login iframe completes on an
anonymous page. The session is saved to `e2e/.auth/user.json`, which the `chromium` project reuses.

Without `CI`, the setup signs in to the local Identity by passkey. **A password cannot be substituted there.**
reCAPTCHA v3 scores the browser environment rather than the person, so an automation-driven password sign-in fails
whoever is typing, while `Login.cshtml.cs` evaluates the passkey branch *before* the captcha.

### Selector ids

The fleet rule, select by `id` and never by class, position, XPath or copy, is in
[AGENTS/TESTING.md](../AGENTS/TESTING.md#e2e-selector-strategy-select-by-id-never-by-position) and
[AGENTS/CODE-STYLE.md](../AGENTS/CODE-STYLE.md) rule 10. This is Inventory's own id table, which
`inventory.client/e2e` selects against.

| Element | `id` |
|---|---|
| Home hero heading | `home-heading` |
| Home hero CTAs | `browse-catalog-link`, `my-products-link`, `home-login-link` |
| Home benefit cards | `benefit-card-{index}` |
| Nav links | `nav-home`, `nav-catalog`, `nav-products`, `nav-login`, `nav-signout` |
| Nav collapsible list (carries `data-open`) | `nav-collapse` |
| User session table, row, claim cells | `user-session-table`, `user-session-row-{index}`, `user-session-claim-type-{index}`, `user-session-claim-value-{index}`, built by `src/user-session/user-session-ids.ts` |
| My-Products heading / empty state / table / search | `products-heading`, `products-empty-state`, `products-table`, `product-search` |
| My-Products row, name cell, actions | `product-row-{index}`, `product-name-{index}`, `view-product-{index}`, `edit-product-{index}`, `delete-product-{index}`, `confirm-delete-product-{index}`. The row and action ids are built by `src/product-row-ids.ts` and `src/view-product-ids.ts`, which the template, the specs and the walker all import, so a renamed id cannot leave a selector behind |
| Catalog heading / empty state / table | `catalog-heading`, `catalog-empty-state`, `catalog-table` |
| Catalog row, name cell, View link | `catalog-row-{index}`, `catalog-name-{index}`, `view-product-{index}`. The row and name ids are built by `src/catalog-row-ids.ts` |
| Catalog paging summary | `catalog-showing` |
| Catalog sort headers and pager | `sort-by-name`, `catalog-prev-page`, `catalog-next-page`. The two pager ids are bound from `catalog-list.component.ts` rather than written in the template, because the `@if` anchor and `@else` disabled button share one id and ReSharper's HTML analysis does not evaluate Angular control flow ([Inventory.md](../AGENTS/REPOS/Inventory.md)) |
| Detail headings | `product-detail-heading`, `catalog-detail-heading` |
| Not-found headings | `product-not-found-heading`, `catalog-not-found-heading` |
| Detail page actions | `view-manual-link`, `edit-product-link` |
| Product form fields, submit and error | `name`, `brand`, `pricePaid`, `modelNumber`, `serialNumber`, `msrpPrice`, `purchaseDate`, `category`, `description`, `manualUrl`, `product-form-submit`, `product-form-error` |
| Manual finder | `manual-chat-toggle`, `manual-chat-panel`, `manual-chat-close`, `manual-chat-messages`, `manual-chat-input`, `manual-chat-send`, `url-chip-{messageIndex}-{urlIndex}` |

Two consequences worth stating, because both replaced a selector that had gone wrong:

- **A value inside a container is asserted on the container.** `expect(page.locator('#products-table')).toContainText(name)` selects by id and puts the copy in the assertion, where `getByRole('cell', { name })` and `Filter(new LocatorFilterOptions { HasText = … })` put it in the selector. Where a single field is the subject, the field has its own id and the assertion is `ToHaveTextAsync`, which is exact.
- **A set is selected by id prefix**, never by tag: `[id^='product-row-']` in place of `tbody tr`, `[id^='url-chip-']` in place of `.manual-chat-panel button.url-chip`. `url-chip` ids carry **both** loop indices because the chips loop is nested inside the messages loop, so the inner `$index` alone would repeat across messages.

`url-chip-{messageIndex}-{urlIndex}` needs the `@for (msg of messages(); track $index; let messageIndex = $index)` alias in
`manual-chat.component.html`; without the alias the inner loop's `$index` shadows the outer one.

### TypeScript Playwright suite (`inventory.client/e2e`)

This suite runs on push/PR as the workflow's `Run browser E2E tests` step (`npm run e2e:ci`, the `chromium` project only, so
a push never starts a walk). Its `synthetic` project runs on a schedule instead (see **Synthetic walker** below).

**Without `CI`, `auth.setup.ts` signs in by passkey on slot 3**, through `loginWithPasskey({ slot: 3, … })` from
`@crgolden/modules/synthetic-walker`. Slot 1 carries admin claims everywhere and is reserved for privileged flows;
Inventory has no roles, so its suite signs in as a non-admin.

`playwright.config.ts` starts the servers itself unless `SKIP_WEBSERVER=1` is set, which is the switch to use when they
are already running locally. With `CI` set every server starts fresh (`reuseExistingServer: false`), so a run never
adopts a stranger's BFF pointed somewhere else; the mock Products seeds enough catalog rows to overflow the scroll
test's shortened viewport, and every other row a spec needs it creates itself.

**The suite cleans up only through the UI.** `e2e/ci-products.ts` mints every product from generated values
(`newProduct()`), and each journey that creates one deletes it through the product list before completing. The walker's
API sweep (`e2e/product-sweep.ts`) belongs to the walker layer; generated brands and model numbers stop two runs
colliding on Products' unique Brand + ModelNumber match key.

**Specs seed through the API, not through the form.** `createProduct()` in `e2e/ci-products.ts` posts to
`/products/api/inventory/items` and returns both the inventory-item id and the catalog-product id. Products creates or
matches the catalog row inside that same request, before the 201 returns, so a spec can address its own catalog row with
no polling. Driving the create form is reserved for the specs whose subject *is* the form.

**`catalog.spec.ts` covers the catalog surface**: View on a row opens that product's detail page, an unknown id lands on
`/catalog/not-found`, and Back returns the reader to where they were in the list. That last one is what pins
`withInMemoryScrolling`, and it shortens the viewport rather than seeding rows; the scroll-measurement traps that make it
discriminate are in [Inventory.md](../AGENTS/REPOS/Inventory.md).

**`manual-chat-layout.spec.ts` routes its chat calls to a fixed SSE body.** Its subject is the panel's own layout: the
message list must fit inside the panel, must scroll once it overflows, and the panel must not extend past the bottom of
the viewport. jsdom has no layout, so Vitest cannot take it, and it needs a reply long enough to guarantee the overflow,
which the fixed body supplies whether the BFF points at the mock Manuals or a local one.

### Synthetic walker

`e2e/synthetic/walker.spec.ts` performs a **seeded random walk of the deployed app**: one real login through Identity
(`/bff/login?returnUrl=…`), a silent-login check that clears only the Inventory host's cookies, reloads `/catalog`, waits
for the `prompt=none` request and asserts `#nav-signout` is back (so the Identity session restores the BFF session),
a sweep that deletes any leftover `Synthetic Walker Product` rows from a crashed prior run,
then a weighted random sequence of actions — catalog and product browsing plus **scoped writes**: product
create→edit→delete cycles under names `` `Synthetic Walker Product <seed>-<n>` ``, with a second sweep at run end so a
normal run leaves zero rows. Edits never touch the `#name` prefix, or the orphan becomes unfindable. The manual-finder
chat (`#manual-chat-send`) is deliberately excluded — it calls Azure OpenAI. It runs on a schedule from
`.github/workflows/synthetic.yml` (twice daily, plus `workflow_dispatch` with a `seed` input) and is **never a merge
gate**. Tests skip unless `WalkerBaseUrl` is set — the config's fleet-standard switch that also disables `webServer` and
points `baseURL` at the deployed app.

**This walker is also what replaced the post-deploy smoke tier**, which was deleted fleet-wide. Smoke ran the same
product CRUD lifecycle against the same deployed app under the same account, but needed a reCAPTCHA exemption to log
in and had no sweep; the walker covers it without either.

Environment contract:

| Variable | Meaning |
|---|---|
| `WalkerBaseUrl` | Deployed app URL; disables `webServer`, overrides `baseURL` |
| `SYNTHETIC_SEED` | **Required** decimal uint32; the whole walk derives from it |
| `SYNTHETIC_STEPS` | Optional step budget override; its default and ceiling are `stepBudget` in `inventory.client/e2e/synthetic/walker-settings.json` |
| `PASSKEY_CREDENTIAL1` | The walker account's passkey, as the five-field JSON Playwright's virtual authenticator returns |

Replay a failed walk with the seed from the job summary / failure message:

```powershell
$env:SYNTHETIC_SEED = '<seed>'; $env:WalkerBaseUrl = 'https://crgolden-inventory.azurewebsites.net'; npm run e2e:synthetic
```

Same seed ⇒ same RNG decisions given the same action availability; divergence caused by live-data drift is expected —
the guarantee is the decision sequence.

- **The seed is a run parameter, not unit-test data.** CODE-STYLE.md rule 11 is scoped to unit tests; do not "fix" the
  walker by making the seed unrepeatable.
- **The engine comes from `@crgolden/modules/synthetic-walker`** (the Modules repo). Installing it needs GitHub
  Packages auth — CI uses the `PACKAGES_READ_TOKEN` secret; locally a `read:packages` PAT in your user `~/.npmrc`.
  A 401 on the `@crgolden` scope during `npm ci` means the token is missing. This binds the **.NET build too**:
  `inventory.client.esproj` runs `npm install` from inside `dotnet build`, so the CI build job carries
  `NODE_AUTH_TOKEN` at job level, and a local `dotnet build` of the solution fails on the `@crgolden` scope
  without the PAT (`-p:BuildProjectReferences=false` compiles a test project against existing outputs).
- **The walker signs in with a passkey, not a password.** Identity evaluates the passkey branch *before* the
  CAPTCHA, so this is a first-class production auth path rather than an exemption — there is no marker header,
  no email allowlist, and no test-only code in Identity's authentication handler. No password is stored in CI.
  A login failure here means the credential in `PASSKEY_CREDENTIAL1` has been revoked, rotated, or drifted from
  what Identity stores; the walker dashboard shows that as `succeeded="false"` bars rather than as silence.
  Accounts and the enrollment runbook: `Tools/Identity/AGENTS.md` (private repo).
- Walker traffic is identifiable by the User-Agent suffix `crgolden-synthetic/1.0`, and **that suffix is a
  contract** — five Tempo dashboard panels and Identity's `identity.login.passkey_signins` counter both key on
  it. It is an observability dimension only: no authentication or authorization decision reads it.
- **GitHub disables scheduled workflows after 60 days without repo activity in public repos**; a push, a
  `workflow_dispatch`, or the Actions UI re-enables it. Schedules fire from `master` only.

### Manual chat coverage

**The chat panel's behavior is Vitest's, not the browser suite's.** `manual-chat.component.spec.ts`,
`manual-chat-panel.component.spec.ts`, `chat.service.spec.ts` and `product-form.component.spec.ts` cover the
open/close toggle, SSE delta accumulation, URL extraction from assistant content, chip selection and the
`manualUrl` patch, all against a stubbed `ChatService`. Asserting those again through a browser would add a
slower copy of the same evidence.

What a browser adds that jsdom cannot is **layout**. `manual-chat-layout.spec.ts` covers that, and it is the only
spec here permitted to stub its upstream.

---

## CI pipeline

### Build job (every push / PR)

1. Build solution (`dotnet build --no-incremental --configuration Release /p:AngularConfiguration=ci`), under which Angular uses `environment.ci.ts`. `dotnet publish` rebuilds Angular without the override, producing the `production` bundle for the deployed artifact.
2. Backend unit tests with coverage (`dotnet coverlet … --filter-trait Category=Unit`, OpenCover → `coverage.opencover.xml`)
3. Frontend unit tests with coverage (`npx vitest run --coverage`)
4. Azure login (OIDC)
5. Cache + install Playwright Chromium
6. Browser E2E tests (`npm run e2e:ci`)
7. Assert the browser E2E run executed a nonzero test count
8. Publish app + SonarCloud analysis

**Step 7 is not ceremony.** An aborted Playwright run still writes `tests="0" failures="0"` to
`playwright-results.xml`, which every reporter reads as a pass, so a suite that never started is
indistinguishable from a suite that passed without it.

There is no post-deploy job. The deployed app is exercised by the scheduled **synthetic walker**
(`.github/workflows/synthetic.yml`), which runs from the same TypeScript suite under its own project.

### Playwright browser cache

The build job caches the Chromium binary at `~\AppData\Local\ms-playwright` on Windows runners, keyed on the
`@playwright/test` version read out of `inventory.client/package-lock.json`. **That read must fail loudly**: if
it yields nothing the key silently collapses to a constant, and every run restores a stale browser that no
longer matches the installed Playwright.

### Playwright reporting

`playwright.config.ts` writes a `list` reporter to the log, an HTML report to `inventory.client/playwright-report/`
and JUnit XML to `inventory.client/playwright-results.xml`; CI uploads the last two. Traces are captured
`on-first-retry`, so a failure that reproduces on retry carries a trace and a first-attempt flake does not.

CI uploads these artifacts separately from TRX:

| Job | Artifact |
|---|---|
| Browser E2E | `inventory-browser-e2e-artifacts` |
| Synthetic walker | `synthetic-playwright-report`, `synthetic-playwright-artifacts` |

GitHub Actions artifacts are the only reporting destination. The workflow steps that used to mirror the same TRX outcomes to Azure DevOps test runs and Azure Monitor custom events are retired and removed.

Two workflow decisions that are not obvious from reading the YAML:

- **`actions/checkout` sets `fetch-depth: 0` for SonarCloud, not for the build.** A shallow clone costs Sonar the history it uses to attribute issues to changesets and to compute new-code metrics.
- **The "Fix LCOV paths for SonarQube" step only rewrites `\` to `/`; it must not prefix `inventory.client/`.** The Scanner for .NET (v8+) indexes `inventory.client` as its own module whose base directory *is* `inventory.client`, so the JS coverage sensor resolves both `sonar.javascript.lcov.reportPaths` (`coverage/lcov.info`) and the LCOV `SF:` paths module-relative (`src/…`), never repo-relative. Adding the prefix double-nests the path and the sensor reports "No LCOV files were found". The separator rewrite is needed because istanbul emits backslashes on Windows runners.

Do not run Git commands when implementing or verifying Playwright reporting changes.

---

## Local SonarCloud analysis

Generate coverage files first, then run from `Inventory/`. Unit coverage is OpenCover (branch-bearing,
via `coverlet.console` pinned in `dotnet-tools.json`, restored with `dotnet tool restore`) and the frontend
emits LCOV. SonarCloud unions the two. **The browser E2E suite contributes no coverage report**: it drives a
deployed BFF out of process, so nothing instruments it, and `inventory.client/e2e/**` sits in
`sonar.coverage.exclusions` rather than `sonar.exclusions` so the specs are still analyzed as code.

```powershell
# .NET unit (OpenCover) — the Inventory.Server BFF surface is tiny; real client logic is Vitest/LCOV
dotnet build Inventory.Tests.Unit --configuration Release /p:AngularConfiguration=ci
dotnet tool restore
dotnet coverlet Inventory.Tests.Unit\bin\Release\net10.0 `
  --target "dotnet" `
  --targetargs "test --project Inventory.Tests.Unit --no-build --configuration Release -- --filter-trait Category=Unit" `
  --format opencover --output "coverage.opencover.xml" `
  --skipautoprops --exclude-by-attribute GeneratedCodeAttribute `
  --exclude-by-file "**/obj/**" --exclude-by-file "**/Program.cs" `
  --does-not-return-attribute DoesNotReturnAttribute --include "[Inventory.Server]*"

# Frontend LCOV comes from `npx vitest run --coverage`. See CI.

$env:SONAR_TOKEN = "<token>"
& "$env:SystemDrive\sonar-scanner-8.0.1.6346-windows-x64\bin\sonar-scanner.bat" `
  "-Dsonar.projectKey=crgolden_Inventory" `
  "-Dsonar.organization=crgolden" `
  "-Dsonar.sources=Inventory.Server,inventory.client/src" `
  "-Dsonar.tests=Inventory.Tests.Unit" `
  "-Dsonar.exclusions=inventory.client/aspnetcore-https.js,inventory.client/start-os.js,**/bin/**,**/obj/**,**/node_modules/**,**/*.d.ts" `
  "-Dsonar.coverage.exclusions=inventory.client/e2e/**,inventory.client/src/test-setup.ts" `
  "-Dsonar.test.inclusions=**/*.spec.ts" `
  "-Dsonar.cs.opencover.reportsPaths=coverage.opencover.xml" `
  "-Dsonar.javascript.lcov.reportPaths=inventory.client/coverage/lcov.info"
```

Required coverage files: `coverage.opencover.xml` (unit, OpenCover) and `inventory.client/coverage/lcov.info`.
