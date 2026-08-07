#Requires -Version 7

<#
.SYNOPSIS
    Runs the Inventory smoke test suite.
.DESCRIPTION
    Credentials are read from User Secrets (ID 5480cab8-b41b-4dae-8c41-dbc2c01a15e0) so they never
    need to be set as OS environment variables.
.PARAMETER BaseUrl
    Target for the smoke tests. Defaults to the deployed app. For local runs, pass
    https://localhost:7150 — requires Identity, Inventory, and Products running locally, and Identity
    must use reCAPTCHA test keys (set via its own User Secrets).
.EXAMPLE
    .\Invoke-SmokeTests.ps1
    Runs against the deployed app at https://crgolden-inventory.azurewebsites.net.
.EXAMPLE
    .\Invoke-SmokeTests.ps1 -BaseUrl https://localhost:7150
    Runs against a locally running instance.
#>
param(
    [string]$BaseUrl = "https://crgolden-inventory.azurewebsites.net"
)

$secretsPath = Join-Path $env:APPDATA "Microsoft\UserSecrets\5480cab8-b41b-4dae-8c41-dbc2c01a15e0\secrets.json"
$secrets     = Get-Content $secretsPath -Raw | ConvertFrom-Json

$env:SmokeBaseUrl = $BaseUrl
$env:AdminEmail  = $secrets.AdminEmail
$env:AdminPassword  = $secrets.AdminPassword

try
{
    & ".\Inventory.Tests.E2E\bin\Debug\net10.0\Inventory.Tests.E2E.exe" -trait "Category=Smoke" -showLiveOutput
}
finally
{
    Remove-Item Env:SmokeBaseUrl, Env:AdminEmail, Env:AdminPassword -ErrorAction SilentlyContinue
}
