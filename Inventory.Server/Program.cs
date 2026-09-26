using System.Diagnostics;
using System.Security.Claims;
using Azure.Identity;
using Duende.Bff;
using Duende.Bff.DynamicFrontends;
using Duende.Bff.Yarp;
using Elastic.Ingest.Elasticsearch;
using Elastic.Ingest.Elasticsearch.DataStreams;
using Elastic.Serilog.Sinks;
using Elastic.Transport;
using Inventory.Authentication;
using Inventory.Extensions;
using Inventory.Logging;
using Inventory.Telemetry;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Azure;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using OpenTelemetry.Instrumentation.AspNetCore;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    var openIdConnectOptionsSection = builder.Configuration.GetRequiredSection(nameof(OpenIdConnectOptions));
    var openIdConnectOptions = openIdConnectOptionsSection.Get<OpenIdConnectOptions>() ?? throw new InvalidOperationException($"Invalid '{nameof(OpenIdConnectOptions)}' section.");
    if (!string.Equals(openIdConnectOptions.ResponseType, OpenIdConnectResponseType.Code, StringComparison.Ordinal))
    {
        throw new InvalidOperationException($"'{nameof(OpenIdConnectOptions)}:{nameof(OpenIdConnectOptions.ResponseType)}' must be '{OpenIdConnectResponseType.Code}'; '{openIdConnectOptions.ResponseType}' silently disables PKCE.");
    }

    Uri oidcAuthority = builder.Configuration.GetRequired<Uri>("OidcAuthority"),
        manualsApiAddress = builder.Configuration.GetRequired<Uri>("ManualsApiAddress"),
        productsApiAddress = builder.Configuration.GetRequired<Uri>("ProductsApiAddress");
    string inventoryClientId = builder.Configuration.GetRequired<string>("InventoryClientId"),
        inventoryClientSecret = builder.Configuration.GetRequired<string>("InventoryClientSecret");
    if (builder.Environment.IsProduction())
    {
        var defaultAzureCredentialOptionsSection = builder.Configuration.GetRequiredSection(nameof(DefaultAzureCredentialOptions));
        var defaultAzureCredentialOptions = defaultAzureCredentialOptionsSection.Get<DefaultAzureCredentialOptions>() ?? throw new InvalidOperationException($"Invalid '{nameof(DefaultAzureCredentialOptions)}' section.");
        var tokenCredential = new DefaultAzureCredential(defaultAzureCredentialOptions);
        Uri blobUri = builder.Configuration.GetRequired<Uri>("BlobUri"),
            dataProtectionKeyIdentifier = builder.Configuration.GetRequired<Uri>("DataProtectionKeyIdentifier"),
            elasticsearchNode = builder.Configuration.GetRequired<Uri>("ElasticsearchNode");
        var applicationName = builder.Configuration.GetRequired<string>("WEBSITE_SITE_NAME");
        var elasticsearchUsername = builder.Configuration.GetRequired<string>("ElasticsearchUsername");
        var elasticsearchPassword = builder.Configuration.GetRequired<string>("ElasticsearchPassword");
        builder.Services.Configure<AspNetCoreTraceInstrumentationOptions>(options =>
            options.Filter = TracedRequests.ShouldTrace);
        builder.Logging.AddOpenTelemetry(openTelemetryLoggerOptions =>
        {
            openTelemetryLoggerOptions.IncludeFormattedMessage = true;
            openTelemetryLoggerOptions.IncludeScopes = true;
        });
        builder.Services
            .AddSerilog((serviceProvider, loggerConfiguration) => loggerConfiguration
                .ReadFrom.Configuration(builder.Configuration)
                .ReadFrom.Services(serviceProvider)
                .Enrich.WithProperty(nameof(IHostEnvironment.ApplicationName), applicationName)
                .Filter.ByExcluding(DuendeLicenseNotice.IsNoLicenseConfiguredNotice)
                .WriteTo.Elasticsearch(
                    [elasticsearchNode],
                    elasticsearchSinkOptions =>
                    {
                        elasticsearchSinkOptions.DataStream = new DataStreamName("logs", "app", nameof(Inventory));
                        elasticsearchSinkOptions.BootstrapMethod = BootstrapMethod.Failure;
                        elasticsearchSinkOptions.TextFormatting.MapCustom = (ecsDocument, _) =>
                        {
                            ecsDocument.Service ??= new Elastic.CommonSchema.Service();
                            ecsDocument.Service.Name = applicationName;
                            return ecsDocument;
                        };
                    },
                    transportConfiguration =>
                    {
                        var header = new BasicAuthentication(elasticsearchUsername, elasticsearchPassword);
                        transportConfiguration.Authentication(header);
                    }))
            .AddOpenTelemetry()
            .ConfigureResource(resourceBuilder => resourceBuilder
                .AddService(applicationName, null, typeof(Program).Assembly.GetName().Version?.ToString() ?? "0.0.0")
                .AddAttributes(new Dictionary<string, object>
                {
                    ["deployment.environment"] = builder.Environment.EnvironmentName.ToLowerInvariant()
                }))
            .WithMetrics(meterProviderBuilder => meterProviderBuilder
                .AddMeter("Microsoft.AspNetCore.Hosting")
                .AddRuntimeInstrumentation()
                .AddOtlpExporter(o => o.Endpoint = new Uri(builder.Configuration.GetRequired<string>("AlloyEndpoint"))))
            .WithTracing(tracerProviderBuilder => tracerProviderBuilder
                .SetSampler(new AlwaysOnSampler())
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddOtlpExporter(o => o.Endpoint = new Uri(builder.Configuration.GetRequired<string>("AlloyEndpoint"))))
            .Services
            .AddDataProtection()
            .SetApplicationName(applicationName)
            .PersistKeysToAzureBlobStorage(blobUri, tokenCredential)
            .ProtectKeysWithAzureKeyVault(dataProtectionKeyIdentifier, tokenCredential).Services
            .AddAzureClientsCore(true);
    }
    else
    {
        builder.Services
            .AddSerilog((serviceProvider, loggerConfiguration) => loggerConfiguration
                .ReadFrom.Configuration(builder.Configuration)
                .ReadFrom.Services(serviceProvider))
            .AddDataProtection()
            .UseEphemeralDataProtectionProvider();
    }

    builder.Services
        .AddAuthentication(options =>
        {
            options.DefaultScheme = BffAuthenticationSchemes.BffCookie;
            options.DefaultChallengeScheme = BffAuthenticationSchemes.BffOpenIdConnect;
            options.DefaultSignOutScheme = BffAuthenticationSchemes.BffOpenIdConnect;
        }).Services
        .AddBff()
        .AddRemoteApis()
        .ConfigureOpenIdConnect(options =>
        {
            options.Authority = oidcAuthority.ToString();
            options.ClientId = inventoryClientId;
            options.ClientSecret = inventoryClientSecret;
            foreach (var scope in openIdConnectOptions.Scope)
            {
                options.Scope.Add(scope);
            }

            options.ResponseType = openIdConnectOptions.ResponseType;
            options.ResponseMode = openIdConnectOptions.ResponseMode;
            options.SaveTokens = openIdConnectOptions.SaveTokens;
            options.GetClaimsFromUserInfoEndpoint = openIdConnectOptions.GetClaimsFromUserInfoEndpoint;
            options.MapInboundClaims = openIdConnectOptions.MapInboundClaims;
            options.TokenValidationParameters = openIdConnectOptions.TokenValidationParameters;
            options.RequireHttpsMetadata = openIdConnectOptions.RequireHttpsMetadata;
            if (builder.Environment.IsProduction())
            {
                return;
            }

            options.Events = new OpenIdConnectEvents
            {
                OnRedirectToIdentityProvider = context =>
                {
                    context.ProtocolMessage.RedirectUri = ListeningAddress.CallbackUri(context.HttpContext, options.CallbackPath) ?? context.ProtocolMessage.RedirectUri;
                    return Task.CompletedTask;
                },
                OnRedirectToIdentityProviderForSignOut = context =>
                {
                    context.ProtocolMessage.PostLogoutRedirectUri = ListeningAddress.CallbackUri(context.HttpContext, options.SignedOutCallbackPath) ?? context.ProtocolMessage.PostLogoutRedirectUri;
                    return Task.CompletedTask;
                }
            };
        })
        .ConfigureCookies(cookieAuthenticationOptions =>
        {
            cookieAuthenticationOptions.Cookie.SameSite = SameSiteMode.Strict;
        }).Services
        .AddAuthorization()
        .AddHealthChecks().Services
        .Configure<ForwardedHeadersOptions>(forwardedHeadersOptions =>
        {
            forwardedHeadersOptions.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            forwardedHeadersOptions.KnownIPNetworks.Clear();
            forwardedHeadersOptions.KnownProxies.Clear();
        });

    var webApplication = builder.Build();
    webApplication.UseForwardedHeaders();
    webApplication.UseSerilogRequestLogging(options => options.EnrichDiagnosticContext = (diagnosticContext, _) =>
    {
        if (Activity.Current is null)
        {
            return;
        }

        diagnosticContext.Set(nameof(Activity.TraceId), Activity.Current.TraceId.ToString());
        diagnosticContext.Set(nameof(Activity.SpanId), Activity.Current.SpanId.ToString());
    });
    if (webApplication.Environment.IsDevelopment())
    {
        webApplication.UseDeveloperExceptionPage();
    }
    else
    {
        webApplication.UseHsts();
    }

    webApplication.UseHttpsRedirection().UseAuthorization();
    webApplication.Use((ctx, next) =>
    {
        if (ctx.User.Identity?.IsAuthenticated != true)
        {
            return next(ctx);
        }

        using (Serilog.Context.LogContext.PushProperty("UserId", ctx.User.FindFirstValue("sub")))
        using (Serilog.Context.LogContext.PushProperty("UserEmail", ctx.User.FindFirstValue("email")))
        {
            return next(ctx);
        }
    });
    webApplication.MapHealthChecks(TracedRequests.HealthPathPrefix).DisableHttpMetrics();
    webApplication
        .UseAuthentication()
        .UseBff();
    webApplication.MapRemoteBffApiEndpoint("/manuals/api", manualsApiAddress).WithAccessToken();
    webApplication.MapRemoteBffApiEndpoint("/products/api", productsApiAddress).WithAccessToken();
    webApplication.MapRemoteBffApiEndpoint("/catalog/api", productsApiAddress);
    webApplication.UseDefaultFiles();
    webApplication.MapStaticAssets();
    webApplication.MapFallbackToFile("/index.html");
    await webApplication.RunAsync();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    await Log.CloseAndFlushAsync();
}
