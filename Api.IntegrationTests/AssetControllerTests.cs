namespace Inventory.Api.IntegrationTests
{
    using System;
    using System.Diagnostics;
    using System.Net.Http;
    using System.Text.Json;
    using System.Threading.Tasks;
    using Microsoft.AspNetCore.Mvc.Testing;
    using Microsoft.Extensions.Configuration;
    using Services.Extensions;
    using Xunit;
    using Xunit.Abstractions;
    using static System.Guid;
    using static System.Net.Mime.MediaTypeNames.Application;
    using static System.Text.Encoding;
    using static System.Text.Json.JsonNamingPolicy;
    using static System.Text.Json.JsonSerializer;
    using static System.TimeSpan;
    using static System.UriKind;
    using static ClassMaps;
    using static IndexModels;

    public class AssetControllerTests : IClassFixture<WebApplicationFactory<Startup>>
    {
        private readonly ITestOutputHelper _output;
        private WebApplicationFactory<Startup> _factory;

        public AssetControllerTests(
            ITestOutputHelper output,
            WebApplicationFactory<Startup> factory) => (_output, _factory) = (output, factory);

        private static JsonSerializerOptions JsonSerializerOptions => new JsonSerializerOptions
        {
            PropertyNamingPolicy = CamelCase,
            PropertyNameCaseInsensitive = true
        };

        [Fact]
        public async Task PostGetPatchPutGetDeleteGet()
        {
            // Arrange
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
            await _factory.Services.BuildIndexesAsync(AssetIndexes).ConfigureAwait(true);
            var client = _factory.CreateClient();
            var model = new Asset
            {
                Name = NewGuid().ToString()
            };
            var content = Serialize(model, JsonSerializerOptions);
            var requestUri = new Uri("/api/v1/Asset", Relative);
            Asset result;

            // Act
            stopwatch.Start();
            using (var httpContent = new StringContent(content, UTF8, Json))
            {
                using var response = await client.PostAsync(requestUri, httpContent).ConfigureAwait(true);
                response.EnsureSuccessStatusCode();
                var body = await response.Content.ReadAsStreamAsync().ConfigureAwait(true);
                result = await DeserializeAsync<Asset>(body, JsonSerializerOptions).ConfigureAwait(true);
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            _output.WriteLine("Model created in   {0}", stopwatch.Elapsed);

            // Assert
            Assert.NotEqual(Empty, result.Id);
            Assert.Equal(model.Name, result.Name);
            Assert.Equal(model.CreatedDate, result.CreatedDate.ToUniversalTime());
            Assert.Null(result.UpdatedDate);
            model.Id = result.Id;
            requestUri = new Uri($"{requestUri}({model.Id})", Relative);

            // Act
            stopwatch.Restart();
            using (var response = await client.GetAsync(requestUri).ConfigureAwait(true))
            {
                response.EnsureSuccessStatusCode();
                var body = await response.Content.ReadAsStreamAsync().ConfigureAwait(true);
                result = await DeserializeAsync<Asset>(body, JsonSerializerOptions).ConfigureAwait(true);
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            _output.WriteLine("Model retrieved in {0}", stopwatch.Elapsed);

            // Assert
            Assert.Equal(model.Id, result.Id);
            Assert.Equal(model.Name, result.Name);
            Assert.Equal(model.CreatedDate, result.CreatedDate.ToUniversalTime(), FromMilliseconds(1));
            Assert.Null(result.UpdatedDate);

            // Arrange
            model.Name = NewGuid().ToString();
            content = Serialize(model, JsonSerializerOptions);
            stopwatch.Restart();
            using (var httpContent = new StringContent(content, UTF8, Json))
            {
                using var response = await client.PatchAsync(requestUri, httpContent).ConfigureAwait(true);
                response.EnsureSuccessStatusCode();
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            _output.WriteLine("Model updated in   {0}", stopwatch.Elapsed);

            // Act
            stopwatch.Restart();
            using (var response = await client.GetAsync(requestUri).ConfigureAwait(true))
            {
                response.EnsureSuccessStatusCode();
                var body = await response.Content.ReadAsStreamAsync().ConfigureAwait(true);
                result = await DeserializeAsync<Asset>(body, JsonSerializerOptions).ConfigureAwait(true);
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            _output.WriteLine("Model retrieved in {0}", stopwatch.Elapsed);

            // Assert
            Assert.Equal(model.Id, result.Id);
            Assert.Equal(model.Name, result.Name);
            Assert.Equal(model.CreatedDate, result.CreatedDate.ToUniversalTime(), FromMilliseconds(1));
            Assert.NotNull(result.UpdatedDate);

            // Arrange
            model.Name = NewGuid().ToString();
            content = Serialize(model, JsonSerializerOptions);
            stopwatch.Restart();
            using (var httpContent = new StringContent(content, UTF8, Json))
            {
                using var response = await client.PutAsync(requestUri, httpContent).ConfigureAwait(true);
                response.EnsureSuccessStatusCode();
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            _output.WriteLine("Model replaced in  {0}", stopwatch.Elapsed);

            // Act
            stopwatch.Restart();
            using (var response = await client.GetAsync(requestUri).ConfigureAwait(true))
            {
                response.EnsureSuccessStatusCode();
                var body = await response.Content.ReadAsStreamAsync().ConfigureAwait(true);
                result = await DeserializeAsync<Asset>(body, JsonSerializerOptions).ConfigureAwait(true);
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            _output.WriteLine("Model retrieved in {0}", stopwatch.Elapsed);

            // Assert
            Assert.Equal(model.Id, result.Id);
            Assert.Equal(model.Name, result.Name);
            Assert.Equal(model.CreatedDate, result.CreatedDate.ToUniversalTime(), FromMilliseconds(1));
            Assert.NotNull(result.UpdatedDate);

            // Arrange
            stopwatch.Restart();
            using (var response = await client.DeleteAsync(requestUri).ConfigureAwait(true))
            {
                response.EnsureSuccessStatusCode();
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            _output.WriteLine("Model deleted in   {0}", stopwatch.Elapsed);

            // Act
            stopwatch.Restart();
            long length;
            using (var response = await client.GetAsync(requestUri).ConfigureAwait(true))
            {
                response.EnsureSuccessStatusCode();
                var body = await response.Content.ReadAsStreamAsync().ConfigureAwait(true);
                length = body.Length;
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            _output.WriteLine("Model retrieved in {0}", stopwatch.Elapsed);

            // Assert
            Assert.Equal(0, length);
            _output.WriteLine("Finished all in    {0}", total);
        }
    }
}
