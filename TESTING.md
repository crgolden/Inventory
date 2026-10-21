# Testing

The Inventory test suite is split across three tiers: **backend unit tests** (xUnit v3, `Inventory.Tests.Unit`), **frontend unit tests** (Vitest, `inventory.client/`: jsdom specs plus browser-mode specs in real Chromium), and **browser E2E tests** (Gherkin features run by Playwright through `playwright-bdd`, `inventory.client/e2e`).

**Browser testing here is TypeScript only.** The .NET BFF serves the UI and owns no behavior of its own, so it has nothing for an API-integration tier to drive, and a .NET browser tier would only re-drive the pages the TypeScript suite already drives.

Unit tests carry no control flow (no `if`, loop or `try` in a test body). In a Playwright spec a loop is acceptable when it is setup (sending N chat messages to prime state), never an assertion branch.

## Test tiers

| Tier | Trait / tool | Project | Requires Azure? | Requires Angular build? | Runs in CI |
|------|-------------|---------|-----------------|------------------------|------------|
| Backend unit | `Category=Unit` | `Inventory.Tests.Unit` | No | No | Every push/PR |
| Frontend unit | Vitest project `unit` (jsdom, `src/**/*.spec.ts`) | `inventory.client` | No | No | Every push/PR |
| Frontend unit in a real browser | Vitest project `browser` (Chromium through `@vitest/browser-playwright`, `src/**/*.browser.spec.ts`) | `inventory.client` | No | No | Every push/PR |
| Browser E2E | Gherkin features (`e2e/features/*.feature`), `playwright-bdd`, Playwright `--project=chromium` | `inventory.client/e2e` | No. With `CI` set, the BFF signs in against a mock OIDC provider and proxies to mock Products and Manuals; without it, to the local services | Served by `npm start`, which `playwright.config.ts` launches | Every push/PR |
| Synthetic walker | Playwright (`--project=synthetic`) | `inventory.client/e2e/synthetic` | No — targets the deployed app directly | No | Scheduled only, never a merge gate |

There is no separate smoke tier against the deployed app: the synthetic walker covers the product lifecycle there,
with a sweep for the rows it writes.

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

No Azure credentials are needed for any tier: Key Vault, Blob Storage and Elasticsearch are read only under the
`Production` environment. Run `dotnet test` from the repo root.

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
instead of the event turns four of the six red.

`Logging/RequestLogLevelTests.cs` covers the level the request log records. Only one of its seven tests
asserts the downgrade: an `OperationCanceledException` on a request whose `RequestAborted` token fired logs at
`Warning`. The other six pin the levels that do not change. A cancellation the client did not cause, any other exception
on an aborted request, a 5xx status, and the 500 boundary all stay at `Error`. A 4xx status and 499 stay at
`Information`. Dropping the `RequestAborted` check turns the not-client-caused row red, and widening the match to
any exception on an aborted request turns the other-exception row red.

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
`e2e/mocks/` and points the BFF at them; without it the BFF keeps its `appsettings.Development.json` targets (a local
OIDC provider and the local Products and Manuals APIs), and `auth.setup.ts` signs in by passkey, so that run needs
`PASSKEY_CREDENTIAL3`.
Cleanup is described under **The suite sweeps before and after the run** below.

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
  ├── project "chromium"  -> e2e/features/*.feature, compiled by bddgen into .features-gen/chromium,
  │                          steps in e2e/steps/, reusing e2e/.auth/user.json
  └── project "synthetic" -> the scheduled walker, never a merge gate
```

**The BFF is the real SUT and everything it calls is a mock in CI.** The mocks are self-contained `node:http`
servers that Node 24 runs as TypeScript directly (`node e2e/mocks/<name>.ts`). Node resolves only a full file name, so
their relative imports carry the `.ts` extension and `tsconfig.e2e.json` sets `allowImportingTsExtensions`. Their ports and the switch live in
`e2e/mocks/mock-dependencies.ts`, read by the config, the mocks and `auth.setup.ts`. The BFF reaches them through its
ordinary configuration keys (`OidcAuthority`, `ProductsApiAddress`, `ManualsApiAddress`, a generated client id and
secret) and `OpenIdConnectOptions:RequireHttpsMetadata = false`, the one setting that lets it take a plain-HTTP
provider; production leaves it at its default, `true`.

**`[WebServer] An unhandled exception occurred: Port 50212 is already in use` is not the failure.** Green CI runs print
it ahead of their passing tests, so it says nothing about the run on its own. A web server that really failed ends the
run with `Error: Process from config.webServer was not able to start`; read the verdict from that line and the test
summary, never from the port line.

### Authentication

With `CI` set, `auth.setup.ts` sets the mock provider's identity cookie and walks `/bff/login`: the BFF runs its real
OIDC code flow against the mock, which echoes the handler's `nonce`, signs the id token with its own JWKS key and answers
`prompt=none` with `error=login_required` when no identity cookie is present, so the silent-login iframe completes on an
anonymous page. The session is saved to `e2e/.auth/user.json`, which the `chromium` project reuses.

Without `CI`, the setup signs in to the local OIDC provider by passkey, because a provider that scores sign-ins with
a CAPTCHA rejects an automation-driven password sign-in whoever is typing.

### Selector ids

Select by `id`, never by class, position, XPath or copy. This is the id table `inventory.client/e2e` selects
against.

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
| Catalog sort headers and pager | `sort-by-name`, `catalog-prev-page`, `catalog-next-page`. The two pager ids are bound from `catalog-list.component.ts` rather than written in the template, because the `@if` anchor and `@else` disabled button share one id and ReSharper's HTML analysis does not evaluate Angular control flow, so two literal copies read to it as a duplicate id |
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

**The suite sweeps before and after the run.** `e2e/ci-products.ts` mints every product from generated values under
two prefixes from `e2e/e2e-settings.json`: the name starts with `productNamePrefix` and the model number with
`modelNumberPrefix-`. `auth.setup.ts` sweeps both through `sweepE2eProducts` once it has signed in, before any spec
runs, and the `sweep` project (`e2e/sweep.teardown.ts`, the `setup` project's `teardown`) sweeps again after the
suite. The pre-run sweep is the one that matters: a run that crashes, is killed or stops at `--max-failures` never
reaches its own cleanup, and without a sweep at the start its rows would fail every run after it, most visibly the
empty-state spec, which asserts the account holds no products. Each journey still deletes its own product through
the product list, because that deletion is itself under test. The sweep is `e2e/product-sweep.ts`, the same code
the walker uses under its own prefixes; generated brands and model numbers stop two runs colliding on Products'
unique Brand + ModelNumber match key.

**The mock Products honors the sweep's own requests.** It filters the catalog on
`startswith(ModelNumber,'…')`, answers any other `$filter` with 400 rather than ignoring it, and deletes a catalog
row with 204, 404 when it is gone, and 409 while an inventory item still references it. A mock that ignored the
filter or answered every delete 404 would let a sweep that removes nothing pass.

**Retries are 0 and a failure keeps its trace.** A retry that passes relabels a failed attempt as flaky and hides
its cause, and `--max-failures=1` then stops at the next test instead. `trace: 'retain-on-failure'` records every
attempt and keeps the failed one, so the attempt that failed is the one that carries evidence.

**Specs seed through the API, not through the form.** `createProduct()` in `e2e/ci-products.ts` posts to
`/products/api/inventory/items` and returns both the inventory-item id and the catalog-product id. Products creates or
matches the catalog row inside that same request, before the 201 returns, so a spec can address its own catalog row with
no polling. Driving the create form is reserved for the specs whose subject *is* the form.

### Gherkin features

Every browser E2E test is a scenario in `e2e/features/`, written as the user sees it, in the user's words, with no
selectors or implementation details in the Gherkin:

| Feature | Scenarios |
|---|---|
| `signing-in.feature` | A signed-in owner is offered their products; a visitor is asked to sign in; a visitor who tries to open their products is sent to sign in |
| `catalog.feature` | Viewing a product from the catalog; opening a catalog product that does not exist; going back to the catalog keeps my place |
| `products.feature` | My products are listed; an owner with no products is told so; adding, viewing, renaming and deleting a product; opening a product that does not exist; finding a product's manual |

- **`npm run e2e:ci` runs `bddgen` first**, which compiles the features into `.features-gen/chromium/*.spec.js`
  (git-ignored). `typecheck:e2e` runs it too. The `setup`, `sweep` and `synthetic` projects are plain Playwright
  with their own `testDir`, as `playwright-bdd` requires.
- **Steps live one file per feature area in `e2e/steps/`**, built with `createBdd` over the `test` in
  `e2e/steps/fixtures.ts`, and wrap the existing helpers (`ci-products.ts`, `product-list.ts`).
- **The `ctx` fixture carries a scenario's state between steps** (`ScenarioContext`): the product a `Given`
  made, the id a `Given` chose. Reading a value no step set throws, naming the missing `Given`. **Its teardown
  deletes a product the scenario still owns through the product list**, so a scenario that fails midway leaves no
  row for the next one, and a scenario whose subject is the delete clears the context once its `Then` has
  proved the row gone.
- **`@noauth` runs a scenario signed out.** The fixture overrides `storageState` for that tag, the pattern
  `playwright-bdd` documents; the scenario's first step asserts the BFF sees no session.
- **Going back to the catalog keeps my place** is what pins `withInMemoryScrolling`. It shortens the viewport rather
  than seeding rows, because the list pages at twenty rows whatever the store holds, and it asserts the page
  overflows first. It clicks in page (`element.click()` inside `evaluate`) and asserts `scrollY` is unchanged around
  the click, because Playwright's own click scrolls the target into view and the app would then restore wherever the
  driver left the page.
- **Reports**: besides the Playwright HTML report and `playwright-results.xml`, the run writes
  `cucumber-report/messages.ndjson` (Cucumber Messages) and `cucumber-report/index.html` (the business-readable
  report), paths from `e2e/e2e-settings.json`. CI publishes the NDJSON to the `test_results` database with
  `publish-bdd-results` from `@crgolden/modules`, reading its path from that file, and only when the E2E step ran.
  The artifact upload names the `cucumber-report/` directory itself, so a change to the report paths changes that
  upload path too; its `if-no-files-found: ignore` would not report the drift.

**Behavior checked below the E2E layer rather than in a scenario:**

| Behavior | Where |
|---|---|
| The home hero heading renders | `home.component.spec.ts` "renders the hero headline" |
| One benefit card per configured benefit | `home.component.spec.ts` "renders a card for every benefit" |
| Save stays disabled until name, brand and model number are filled | `product-form.component.spec.ts` (create mode) |
| Delete asks for confirmation inline | `product-list.component.spec.ts` "clicking Delete shows inline confirmation" |
| The manual finder's layout on phone and wide screens, and its message list scrolling inside the panel | `manual-chat-panel.layout.browser.spec.ts` |

**`manual-chat-panel.layout.browser.spec.ts` runs in the `browser` Vitest project**, because its subject is layout
and jsdom has none. It renders `ManualChatPanelComponent` in Chromium with the app's own `styles.css` (Tailwind
compiled through the repo's PostCSS config), sets the viewport from `manual-chat-layout-settings.json`, and stubs
`ChatService` with a reply long enough to overflow the list. `src/test-setup.browser.ts` resolves component
templates through Vite's `import.meta.glob`, since the jsdom setup's `node:fs` does not exist in a browser.

### Synthetic walker

`e2e/synthetic/walker.spec.ts` performs a **seeded random walk of the deployed app**: one real login through the OIDC
provider (`/bff/login?returnUrl=…`), a silent-login check that clears only the Inventory host's cookies, reloads
`/catalog`, waits for the `prompt=none` request and then for the frame's `/bff/silent-login-callback` response, and
asserts `#nav-signout` is back (so the provider's session restores the BFF session),
a sweep that deletes any leftover `Synthetic Walker Product` rows from a crashed prior run,
then a weighted random sequence of actions — catalog and product browsing plus **scoped writes**: product
create→edit→delete cycles under names `` `Synthetic Walker Product <seed>-<n>` ``, with a second sweep at run end so a
normal run leaves zero rows. Edits never touch the `#name` prefix, or the orphan becomes unfindable. The manual-finder
chat (`#manual-chat-send`) is deliberately excluded — it calls Azure OpenAI. It runs on a schedule from
`.github/workflows/synthetic.yml` (twice daily, plus `workflow_dispatch` with a `seed` input) and is **never a merge
gate**. The `synthetic` project exists only when `WalkerBaseUrl` is set, the config's fleet-standard switch that also
disables `webServer` and points `baseURL` at the deployed app, so a run without it has no walker to collect.

Environment contract:

| Variable | Meaning |
|---|---|
| `WalkerBaseUrl` | Deployed app URL; disables `webServer`, overrides `baseURL` |
| `SYNTHETIC_SEED` | **Required** decimal uint32; the whole walk derives from it |
| `SYNTHETIC_STEPS` | Optional step budget override; its default and ceiling are `stepBudget` in `inventory.client/e2e/synthetic/walker-settings.json` |
| `PASSKEY_CREDENTIAL1` | The walker account's passkey, as the five-field JSON Playwright's virtual authenticator returns |

Replay a failed walk with the seed from the job summary / failure message:

```powershell
$env:SYNTHETIC_SEED = '<seed>'; $env:WalkerBaseUrl = '<deployed app URL>'; npm run e2e:synthetic
```

Same seed ⇒ same RNG decisions given the same action availability; divergence caused by live-data drift is expected —
the guarantee is the decision sequence.

- **The seed is a run parameter, not unit-test data**; the rule that unit-test data is generated does not apply to it,
  so do not make the seed unrepeatable.
- **The engine comes from the `@crgolden/modules` package's `synthetic-walker` entry point**, installed from GitHub
  Packages ([README.md](README.md#prerequisites)). A 401 on the `@crgolden` scope during `npm ci` means the token is
  missing. This binds the **.NET build too**:
  `inventory.client.esproj` runs `npm install` from inside `dotnet build`, so the CI build job carries
  `NODE_AUTH_TOKEN` at job level, and a local `dotnet build` of the solution fails on the `@crgolden` scope
  without the PAT (`-p:BuildProjectReferences=false` compiles a test project against existing outputs).
- **The walker signs in with a passkey, not a password**, through the provider's ordinary passkey sign-in rather
  than an exemption, so no password is stored in CI. A login failure means the credential in `PASSKEY_CREDENTIAL1`
  has been revoked, rotated, or drifted from what the provider stores. Enroll a passkey for the walker account with
  your provider and store the virtual authenticator's credential there.
- Walker traffic is identifiable by the User-Agent suffix `crgolden-synthetic/1.0`. It is an observability
  dimension only: no authentication or authorization decision reads it.
- **GitHub disables scheduled workflows after 60 days without repo activity in public repos**; a push, a
  `workflow_dispatch`, or the Actions UI re-enables it. Schedules fire from `master` only.

### Manual chat coverage

**The chat panel's behavior is Vitest's, not the browser suite's.** `manual-chat.component.spec.ts`,
`manual-chat-panel.component.spec.ts`, `chat.service.spec.ts` and `product-form.component.spec.ts` cover the
open/close toggle, SSE delta accumulation, URL extraction from assistant content, chip selection and the
`manualUrl` patch, all against a stubbed `ChatService`. Asserting those again through a browser would add a
slower copy of the same evidence.

What a browser adds that jsdom cannot is **layout**, which `manual-chat-panel.layout.browser.spec.ts` covers in the
`browser` Vitest project.

---

## CI pipeline

### Build job (every push / PR)

1. From `inventory.client/`: `npm ci`, `npm run lint`, `npm run typecheck:e2e`, `npm run typecheck:spec`,
   `npm run lint:css`, `npm run audit` (fails on a high or critical advisory)
2. Build solution (`dotnet build --no-incremental --configuration Release /p:AngularConfiguration=ci /p:RestoreLockedMode=true -warnaserror`), under which Angular uses `environment.ci.ts`. `dotnet publish` rebuilds Angular without the override, producing the `production` bundle for the deployed artifact.
3. ReSharper inspection (`jb inspectcode`)
4. Backend unit tests with coverage (`dotnet coverlet … --filter-trait Category=Unit`, OpenCover → `coverage.opencover.xml`)
5. Cache + install Playwright Chromium, which the `browser` Vitest project needs as well as the E2E suite
6. Frontend unit tests with coverage (`npx vitest run --coverage`, both Vitest projects)
7. Browser E2E tests (`npm run e2e:ci`)
8. Assert the browser E2E run executed at least `executedTestFloor` tests (`e2e/e2e-settings.json`)
9. Publish E2E scenario results (`publish-bdd-results`, `vars.TEST_RESULTS_*` and `secrets.TEST_RESULTS_PGPASSWORD`)
10. `npm run lint:utilities` against the built CSS
11. Publish the app, end the SonarCloud analysis, and fail on any open Sonar issue

**Step 8 is not ceremony.** An aborted Playwright run still writes `tests="0" failures="0"` to
`playwright-results.xml`, which every reporter reads as a pass, so a suite that never started is
indistinguishable from a suite that passed without it; and a run that stopped partway reports a
non-zero count, which only a floor catches. Adding or removing a scenario changes the floor in the same
change.

There is no post-deploy job. The deployed app is exercised by the scheduled **synthetic walker**
(`.github/workflows/synthetic.yml`), which runs from the same TypeScript suite under its own project.

### Playwright browser cache

The build job caches the Chromium binary at `~/.cache/ms-playwright` on the Ubuntu runner, keyed on the
`@playwright/test` version read out of `inventory.client/package-lock.json`. **That read must fail loudly**: if
it yields nothing the key silently collapses to a constant, and every run restores a stale browser that no
longer matches the installed Playwright.

### Playwright reporting

`playwright.config.ts` writes a `list` reporter to the log, an HTML report to `inventory.client/playwright-report/`
and JUnit XML to `inventory.client/playwright-results.xml`; CI uploads the last two. Traces are
`retain-on-failure`, so every failed test carries its trace in the HTML report.

CI uploads these artifacts separately from TRX:

| Job | Artifact |
|---|---|
| Browser E2E | `inventory-browser-e2e-artifacts` |
| Synthetic walker | `synthetic-playwright-report`, `synthetic-playwright-artifacts` |

GitHub Actions artifacts are the only reporting destination.

Two workflow decisions that are not obvious from reading the YAML:

- **`actions/checkout` sets `fetch-depth: 0` for SonarCloud, not for the build.** A shallow clone costs Sonar the history it uses to attribute issues to changesets and to compute new-code metrics.
- **The "Fix LCOV paths for SonarQube" step only rewrites `\` to `/`; it must not prefix `inventory.client/`.** The Scanner for .NET (v8+) indexes `inventory.client` as its own module whose base directory *is* `inventory.client`, so the JS coverage sensor resolves both `sonar.javascript.lcov.reportPaths` (`coverage/lcov.info`) and the LCOV `SF:` paths module-relative (`src/…`), never repo-relative. Adding the prefix double-nests the path and the sensor reports "No LCOV files were found". The separator rewrite is needed wherever istanbul emits backslashes, which it does on Windows (the local gate); on the Ubuntu CI runner it changes nothing.

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

# SonarScanner CLI, with SONAR_TOKEN already in the environment and sonar.host.url=https://sonarcloud.io configured
sonar-scanner `
  "-Dsonar.projectKey=crgolden_Inventory" `
  "-Dsonar.organization=crgolden" `
  "-Dsonar.sources=Inventory.Server,inventory.client/src" `
  "-Dsonar.tests=Inventory.Tests.Unit" `
  "-Dsonar.exclusions=**/bin/**,**/obj/**,**/node_modules/**,**/*.d.ts" `
  "-Dsonar.coverage.exclusions=inventory.client/e2e/**,inventory.client/src/test-setup*.ts,**/Program.cs,inventory.client/**/*.config.*,inventory.client/src/environments/**,inventory.client/src/main.ts,inventory.client/aspnetcore-https.js,inventory.client/start-os.js,gate.ps1" `
  "-Dsonar.test.inclusions=**/*.spec.ts" `
  "-Dsonar.cs.opencover.reportsPaths=coverage.opencover.xml" `
  "-Dsonar.javascript.lcov.reportPaths=inventory.client/coverage/lcov.info"
```

Required coverage files: `coverage.opencover.xml` (unit, OpenCover) and `inventory.client/coverage/lcov.info`.
