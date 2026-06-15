# Inventory

[![Build and deploy ASP.Net Core app to Azure Web App - crgolden-inventory](https://github.com/crgolden/Inventory/actions/workflows/main_crgolden-inventory.yml/badge.svg)](https://github.com/crgolden/Inventory/actions/workflows/main_crgolden-inventory.yml)

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=crgolden_Inventory&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=crgolden_Inventory)

A full-stack single-page application built with **Angular 21** and **ASP.NET Core 10**, using the [Backend-for-Frontend (BFF)](https://www.duendesoftware.com/products/bff) security pattern to handle OIDC authentication on the server side.

## Sibling Applications

Inventory is the **end-user surface** of a five-app system. The BFF holds the OIDC session; the SPA never sees an access token directly.

| Repo | Role | How Inventory interacts |
|---|---|---|
| [Identity](https://github.com/crgolden/Identity) | OIDC Identity Provider | OIDC client — login / logout / silent refresh via Duende BFF |
| [Manuals](https://github.com/crgolden/Manuals) | Azure OpenAI chat API | BFF proxies `/manuals/api/**` with access token (scope `manuals`) |
| [Products](https://github.com/crgolden/Products) | OData v4 product catalog API | BFF proxies `/products/api/**` with access token (scope `products`); `/catalog/api/**` proxies anonymously for the public catalog |
| [Infrastructure](https://github.com/crgolden/Infrastructure) | Health monitoring dashboard | Polls Inventory's `/health` endpoint |

## Architecture

```
┌─────────────────────┐        ┌──────────────────────────┐
│  Angular 21 (SPA)   │◄──────►│  ASP.NET Core 10 (BFF)   │
│  :50212 (dev)       │        │  :7150 (dev)             │
└─────────────────────┘        └──────────┬───────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
             ┌──────▼──────┐    ┌──────────▼──────┐    ┌─────────▼──────┐
             │  Azure Key  │    │  Azure Monitor  │    │  Elasticsearch │
             │    Vault    │    │  + OpenTelemetry│    │  + Serilog     │
             └─────────────┘    └─────────────────┘    └────────────────┘
```

**Backend (`Inventory.Server/`)**
- Minimal API with controller-based routing
- [Duende BFF](https://docs.duendesoftware.com/identityserver/v7/bff/) proxies OIDC login/logout and secures API calls
- All secrets (OIDC client credentials, Elasticsearch credentials) fetched at startup from **Azure Key Vault**
- Data protection keys stored in **Azure Blob Storage**, encrypted with an **Azure Key Vault** key
- Distributed tracing and metrics via **OpenTelemetry** exported to **Azure Monitor**
- Structured logging via **Serilog** → Elasticsearch (production) / console (development)

**Frontend (`inventory.client/`)**
- Angular signals for reactive session state, **zoneless** change detection
- Calls `/bff/user` to resolve the authenticated session and display user claims
- Proxies API requests to the ASP.NET Core backend in development

**Feature areas**

| Route | Auth | Backed by |
|---|---|---|
| `/` | anonymous | static (home / landing) |
| `/catalog`, `/catalog/:id` | anonymous | [Products API](https://github.com/crgolden/Products) (read-only OData) via BFF (`/catalog/api/**` → Products `/odata/**`) |
| `/products`, `/products/new`, `/products/:id`, `/products/:id/edit` | authenticated | [Products API](https://github.com/crgolden/Products) via BFF (`/products/api/**` → Products `/odata/**`), with access token attached |
| `/products/new`, `/products/:id/edit` (embedded `ManualChatPanel`) | authenticated | [Manuals API](https://github.com/crgolden/Manuals) via BFF (`/manuals/api/**` → Manuals `/api/**`), with access token attached |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | ASP.NET Core 10 (Minimal API) |
| Auth | Duende BFF 7 |
| Frontend | Angular 21 |
| Observability | Azure Monitor, OpenTelemetry, Serilog, Elasticsearch |
| Hosting | Azure App Service |
| Secrets | Azure Key Vault |
| Data Protection | Azure Blob Storage + Azure Key Vault |

## Prerequisites

| Tool | Version |
|------|---------|
| .NET SDK | 10.0 |
| Node.js | 22+ |
| npm | 11.9.0 |

**Azure resources (production / staging):**
- Azure Key Vault with the secrets listed below
- Azure Blob Storage container for data protection keys
- Azure Monitor workspace (Application Insights connection string)
- Elasticsearch cluster

## Getting Started

### 1. Configure User Secrets

In development, user secrets are used (ID `5480cab8-b41b-4dae-8c41-dbc2c01a15e0`). Set the following:

```jsonc
{
  // Azure credential options (DefaultAzureCredential) — enable az login for local dev
  "DefaultAzureCredentialOptions": {
    "TenantId": "<tenant-id>",
    "ExcludeAzureCliCredential": false,
    "ExcludeVisualStudioCredential": false
  },

  // Key Vault URI
  "KeyVaultUri": "https://<vault-name>.vault.azure.net/",

  // Azure Blob Storage URI for data protection keys
  "BlobUri": "https://<account>.blob.core.windows.net/<container>/keys.xml",

  // Azure Key Vault key URI for data protection key encryption
  "DataProtectionKeyIdentifier": "https://<vault-name>.vault.azure.net/keys/<key-name>/<version>",

  // Elasticsearch node URI
  "ElasticsearchNode": "https://<host>:9200",

  // OpenID Connect options
  "OpenIdConnectOptions": {
    "Scope": [ "openid", "profile" ],
    "SaveTokens": true,
    "GetClaimsFromUserInfoEndpoint": true,
    "MapInboundClaims": false
  }
}
```

**Key Vault secrets required at runtime:**

| Secret name | Description |
|-------------|-------------|
| `ElasticsearchUsername` | Elasticsearch basic auth username |
| `ElasticsearchPassword` | Elasticsearch basic auth password |
| `OidcAuthority` | OIDC provider authority URL |
| `InventoryClientId` | OIDC client ID |
| `InventoryClientSecret` | OIDC client secret |

### 2. Run

The easiest way to run the full stack locally is to open the solution in **Visual Studio** and run the `https` launch profile — this starts the ASP.NET Core backend and the Angular dev server together via the SPA proxy.

Alternatively, run each manually:

**Backend**
```bash
dotnet run --project Inventory.Server
# Available at https://localhost:7150
```

**Frontend** (separate terminal)
```bash
cd inventory.client
npm install
npm start
# Available at https://localhost:50212
```

The Angular dev server proxies `/bff` and other API paths to `https://localhost:7150` via `src/proxy.conf.json`.

## Project Structure

```
Inventory.Server/     # ASP.NET Core 10 BFF — OIDC session, API proxy, data protection
inventory.client/     # Angular 21 SPA — signals, BFF session, chat and product UI
Inventory.Tests/      # xUnit v3 — unit tests (Moq) and E2E tests (Playwright/Chromium)
```

## Commands

> **Shell note:** commands that set environment variables inline use bash syntax. On Windows, use Git Bash, WSL, or set the variables separately before running the `dotnet` command.

```bash
# Build
dotnet build

# Build frontend
cd inventory.client && npm run build
# Output → inventory.client/dist/inventory.client/browser/

# Backend unit tests (no Azure required)
dotnet build Inventory.Tests --configuration Debug
.\Inventory.Tests\bin\Debug\net10.0\Inventory.Tests.exe -trait "Category=Unit" -showLiveOutput

# Backend E2E tests (Playwright; no Azure credentials needed — static-file Kestrel + Playwright API mocks)
.\Inventory.Tests\bin\Debug\net10.0\Inventory.Tests.exe -trait "Category=E2E" -showLiveOutput

# Frontend unit tests (Vitest)
cd inventory.client && npm test

# Publish web app
dotnet publish Inventory.Server -c Release -r win-x86 --self-contained false -o ./publish
```

See [TESTING.md](TESTING.md) for full details on the E2E test infrastructure, CI configuration, and local prerequisites.

## Deployment

The GitHub Actions workflow triggers on pushes to `main` and pull requests.

**Build job** — runs on every trigger:
1. Builds the full solution (`dotnet build --configuration Release`) and the Angular frontend
2. Runs backend unit tests with coverage and frontend unit tests (Vitest)
3. Logs in to Azure via OIDC and runs backend E2E tests with `ASPNETCORE_ENVIRONMENT=CI`
4. Runs SonarCloud analysis, publishes the web app, and uploads the artifact

**Deploy job** — runs after a successful build on `main`:
1. Deploys the web app to **Azure App Service** `crgolden-inventory` (Production slot) via Azure OIDC

Code quality is continuously monitored by [SonarCloud](https://sonarcloud.io/summary/new_code?id=crgolden_Inventory).
