namespace Assets.Api.IntegrationTests
{
    using System;
    using System.Collections.Generic;
    using System.Diagnostics;
    using System.Linq;
    using System.Net.Http;
    using System.Text;
    using System.Text.Json;
    using System.Threading.Tasks;
    using Microsoft.AspNet.OData;
    using Microsoft.AspNetCore.Mvc.Testing;
    using Microsoft.Extensions.Configuration;
    using Services.Extensions;
    using Xunit;
    using Xunit.Abstractions;
    using static System.Guid;
    using static System.Net.Mime.MediaTypeNames.Application;
    using static System.StringComparison;
    using static System.Text.Encoding;
    using static System.Text.Json.JsonNamingPolicy;
    using static System.Text.Json.JsonSerializer;
    using static System.TimeSpan;
    using static System.UriKind;
    using static ClassMaps;
    using static IndexModels;

    public class AssetsControllerTests : IClassFixture<WebApplicationFactory<Startup>>
    {
        private readonly ITestOutputHelper _output;
        private readonly JsonSerializerOptions _jsonSerializerOptions;
        private WebApplicationFactory<Startup> _factory;

        public AssetsControllerTests(
            ITestOutputHelper output,
            WebApplicationFactory<Startup> factory)
        {
            _output = output;
            _jsonSerializerOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = CamelCase,
                PropertyNameCaseInsensitive = true
            };
            _factory = factory;
        }

        [Fact]
        public async Task PostGetPutGetDeleteGet()
        {
            // Arrange
            const int count = 100;
            var total = Zero;
            var stopwatch = new Stopwatch();
            _factory = _factory.WithWebHostBuilder(webHost =>
            {
                webHost.ConfigureAppConfiguration((_, configuration) =>
                {
                    configuration.AddEnvironmentVariables("ASPNETCORE");
                });
            });
            await _factory.Services.InitializeCollectionsAsync(KeyValuePairs).ConfigureAwait(true);
            await _factory.Services.BuildIndexesAsync(AssetIndexes.Key, AssetIndexes.Value).ConfigureAwait(false);
            var client = _factory.CreateClient();
            var models = Enumerable.Range(0, count).Select(x => new Asset
            {
                Name = NewGuid().ToString()
            }).ToList();
            var requestUri = new Uri("/api/v1/Assets", Relative);
            var content = Serialize(models, _jsonSerializerOptions);
            ODataValue<List<Asset>> result;

            // Act
            _output.WriteLine("Starting POST.");
            stopwatch.Start();
            using (var httpContent = new StringContent(content, UTF8, Json))
            {
                using var response = await client.PostAsync(requestUri, httpContent).ConfigureAwait(true);
                response.EnsureSuccessStatusCode();
                var body = await response.Content.ReadAsStreamAsync().ConfigureAwait(true);
                result = await DeserializeAsync<ODataValue<List<Asset>>>(body, _jsonSerializerOptions).ConfigureAwait(true);
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            _output.WriteLine("Finished POST in   {0}.", stopwatch.Elapsed);

            // Assert
            for (var i = 0; i < count; i++)
            {
                var model = result.Value[i];
                Assert.NotEqual(Empty, model.Id);
                Assert.Equal(models[i].Name, model.Name);
                Assert.Equal(models[i].CreatedDate, model.CreatedDate.ToUniversalTime());
                Assert.Null(model.UpdatedDate);
            }

            // Arrange
            models = result.Value;
            models.Sort((x, y) => string.Compare(x.Name, y.Name, Ordinal));
            var sb = new StringBuilder("/api/v1/Assets?$filter=");
            foreach (var model in models)
            {
                sb.Append($"{nameof(Asset.Name)} eq '{model.Name}' or ");
            }

            requestUri = new Uri(sb.ToString().TrimEnd(' ', 'o', 'r'), Relative);

            // Act
            _output.WriteLine("Starting GET.");
            stopwatch.Restart();
            using (var response = await client.GetAsync(requestUri).ConfigureAwait(true))
            {
                response.EnsureSuccessStatusCode();
                var body = await response.Content.ReadAsStringAsync().ConfigureAwait(true);
                result = Deserialize<ODataValue<List<Asset>>>(body, _jsonSerializerOptions);
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            _output.WriteLine("Finished GET in    {0}.", stopwatch.Elapsed);

            // Assert
            for (var i = 0; i < count; i++)
            {
                var model = result.Value[i];
                Assert.Equal(models[i].Id, model.Id);
                Assert.Equal(models[i].Name, model.Name);
                Assert.Equal(models[i].CreatedDate, model.CreatedDate, FromMilliseconds(1));
                Assert.Null(model.UpdatedDate);
            }

            // Arrange
            models.ForEach(model => model.Name = NewGuid().ToString());
            models.Sort((x, y) => string.Compare(x.Name, y.Name, Ordinal));
            content = Serialize(models, _jsonSerializerOptions);
            requestUri = new Uri("/api/v1/Assets", Relative);

            // Act
            _output.WriteLine("Starting PUT.");
            stopwatch.Restart();
            using (var httpContent = new StringContent(content, UTF8, Json))
            {
                using var response = await client.PutAsync(requestUri, httpContent).ConfigureAwait(true);
                response.EnsureSuccessStatusCode();
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            _output.WriteLine("Finished PUT in    {0}.", stopwatch.Elapsed);

            // Arrange
            sb = new StringBuilder("/api/v1/Assets?$filter=");
            foreach (var model in models)
            {
                sb.Append($"{nameof(Asset.Name)} eq '{model.Name}' or ");
            }

            requestUri = new Uri(sb.ToString().TrimEnd(' ', 'o', 'r'), Relative);

            // Act
            _output.WriteLine("Starting GET.");
            stopwatch.Restart();
            using (var response = await client.GetAsync(requestUri).ConfigureAwait(true))
            {
                response.EnsureSuccessStatusCode();
                var body = await response.Content.ReadAsStringAsync().ConfigureAwait(true);
                result = Deserialize<ODataValue<List<Asset>>>(body, _jsonSerializerOptions);
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            _output.WriteLine("Finished GET in    {0}.", stopwatch.Elapsed);

            // Assert
            for (var i = 0; i < count; i++)
            {
                var model = result.Value[i];
                Assert.Equal(models[i].Id, model.Id);
                Assert.Equal(models[i].Name, model.Name);
                Assert.Equal(models[i].CreatedDate, model.CreatedDate, FromMilliseconds(1));
                Assert.NotNull(model.UpdatedDate);
            }

            // Arrange
            var ids = string.Join('&', models.Select(x => x.Id).Select((x, i) => $"ids[{i}]={x}"));
            requestUri = new Uri($"/api/v1/Assets?{ids}", Relative);

            // Act
            _output.WriteLine("Starting DELETE.");
            stopwatch.Restart();
            using (var response = await client.DeleteAsync(requestUri).ConfigureAwait(true))
            {
                response.EnsureSuccessStatusCode();
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            _output.WriteLine("Finished DELETE in {0}.", stopwatch.Elapsed);

            // Arrange
            sb = new StringBuilder("/api/v1/Assets?$filter=");
            foreach (var model in models)
            {
                sb.Append($"{nameof(Asset.Name)} eq '{model.Name}' or ");
            }

            requestUri = new Uri(sb.ToString().TrimEnd(' ', 'o', 'r'), Relative);

            // Act
            _output.WriteLine("Starting GET.");
            stopwatch.Restart();
            using (var response = await client.GetAsync(requestUri).ConfigureAwait(true))
            {
                response.EnsureSuccessStatusCode();
                var body = await response.Content.ReadAsStringAsync().ConfigureAwait(true);
                result = Deserialize<ODataValue<List<Asset>>>(body, _jsonSerializerOptions);
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            _output.WriteLine("Finished GET in    {0}.", stopwatch.Elapsed);

            // Assert
            Assert.Empty(result.Value);
            _output.WriteLine("Finished all in    {0}.", total);
        }
    }
}
