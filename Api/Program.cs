namespace Inventory
{
    using System;
    using System.Threading;
    using System.Threading.Tasks;
    using Microsoft.AspNetCore.Hosting;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.Hosting;
    using Microsoft.Extensions.Logging;
    using static Models.ClassMaps;
    using static Models.IndexModels;
    using static Models.Seeds;

    public static class Program
    {
        public static async Task Main(string[] args)
        {
            var host = CreateHostBuilder(args).Build();
            using var cancellationTokenSource = new CancellationTokenSource();
            var cancellationToken = cancellationTokenSource.Token;
            try
            {
                await host.Services.InitializeCollectionsAsync(KeyValuePairs, cancellationToken: cancellationToken).ConfigureAwait(false);
                await host.Services.BuildIndexesAsync(AssetIndexes, cancellationToken: cancellationToken).ConfigureAwait(false);
                await host.Services.SeedDocumentsAsync(Assets, cancellationToken: cancellationToken).ConfigureAwait(false);
                await host.RunAsync(cancellationToken).ConfigureAwait(false);
            }
            catch
            {
                cancellationTokenSource.Cancel();
                throw;
            }
        }

        public static IHostBuilder CreateHostBuilder(string[] args) => Host
            .CreateDefaultBuilder(args)
            .ConfigureLogging((context, builder) =>
            {
                var section = context.Configuration.GetSerilogOptionsSection();
                builder.ClearProviders().AddSerilog(context.Configuration, section);
                if (context.HostingEnvironment.IsProduction())
                {
                    builder.AddAzureWebAppDiagnostics();
                }
            })
            .ConfigureWebHostDefaults(webBuilder => webBuilder
                .ConfigureAppConfiguration((context, configBuilder) =>
                {
                    if (context.HostingEnvironment.IsProduction())
                    {
                        configBuilder.AddAzureKeyVault("https://crgolden.vault.azure.net/");
                    }
                })
                .UseStartup<Startup>());
    }
}
