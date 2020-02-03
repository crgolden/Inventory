namespace Inventory.Api.IntegrationTests
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
    using Xunit;
    using Xunit.Abstractions;
    using static System.Console;
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
        private readonly List<Asset> _models = Enumerable.Range(0, 1000).Select(_ => new Asset
        {
            Name = NewGuid().ToString()
        }).OrderBy(x => x.Name).ToList();

        private readonly ITestOutputHelper _output;
        private WebApplicationFactory<Startup> _factory;

        public AssetsControllerTests(
            ITestOutputHelper output,
            WebApplicationFactory<Startup> factory) => (_output, _factory) = (output, factory);

        private static JsonSerializerOptions JsonSerializerOptions => new JsonSerializerOptions
        {
            PropertyNamingPolicy = CamelCase,
            PropertyNameCaseInsensitive = true
        };

        [Fact]
        public async Task PostGetPutGetDeleteGet()
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
            await _factory.Services.InitializeCollectionsAsync(KeyValuePairs).ConfigureAwait(false);
            await _factory.Services.BuildIndexesAsync(AssetIndexes).ConfigureAwait(false);
            var client = _factory.CreateClient();
            ODataValue<List<Asset>> value;
            var content = Serialize(_models, JsonSerializerOptions);
            var requestUri = new Uri("/api/v1/Assets", Relative);

            // Act
            stopwatch.Start();
            using (var httpContent = new StringContent(content, UTF8, Json))
            {
                using var response = await client.PostAsync(requestUri, httpContent).ConfigureAwait(false);
                response.EnsureSuccessStatusCode();
                var body = await response.Content.ReadAsStreamAsync().ConfigureAwait(false);
                value = await DeserializeAsync<ODataValue<List<Asset>>>(body, JsonSerializerOptions).ConfigureAwait(false);
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            var message = $"Models created in   {stopwatch.Elapsed}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(false);

            // Assert
            for (var i = 0; i < value.Value.Count; i++)
            {
                var model = value.Value[i];
                Assert.NotEqual(Empty, model.Id);
                Assert.Equal(_models[i].Name, model.Name);
                Assert.Equal(_models[i].CreatedDate, model.CreatedDate.ToUniversalTime());
                Assert.Null(model.UpdatedDate);
                _models[i].Id = model.Id;
            }

            // Act
            stopwatch.Restart();
            var count = await AssertQuery(client).ConfigureAwait(false);
            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            message = $"Models retrieved in {stopwatch.Elapsed}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(false);

            // Assert
            Assert.Equal(_models.Count, count);

            // Arrange
            _models.ForEach(model => model.Name = NewGuid().ToString());
            _models.Sort((x, y) => string.Compare(x.Name, y.Name, Ordinal));
            content = Serialize(_models, JsonSerializerOptions);
            stopwatch.Restart();
            using (var httpContent = new StringContent(content, UTF8, Json))
            {
                using var response = await client.PutAsync(requestUri, httpContent).ConfigureAwait(false);
                response.EnsureSuccessStatusCode();
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            message = $"Models replaced in  {stopwatch.Elapsed}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(false);

            // Act
            stopwatch.Restart();
            count = await AssertQuery(client, true).ConfigureAwait(false);
            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            message = $"Models retrieved in {stopwatch.Elapsed}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(false);

            // Assert
            Assert.Equal(_models.Count, count);

            // Arrange
            var ids = string.Join('&', _models.Select(x => x.Id).Select((x, j) => $"ids[{j}]={x}"));
            requestUri = new Uri($"/api/v1/Assets?{ids}", Relative);
            stopwatch.Restart();
            using (var response = await client.DeleteAsync(requestUri).ConfigureAwait(false))
            {
                response.EnsureSuccessStatusCode();
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            message = $"Models deleted in   {stopwatch.Elapsed}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(false);

            // Act
            stopwatch.Restart();
            count = await AssertQuery(client).ConfigureAwait(false);
            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            message = $"Models retrieved in {stopwatch.Elapsed}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(false);

            // Assert
            Assert.Equal(0, count);
            message = $"Finished all in     {total}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(false);
        }

        private async Task<int> AssertQuery(HttpClient client, bool updated = default)
        {
            // Arrange
            const int maxPerQuery = 100;
            var requestCount = _models.Count / maxPerQuery;
            var values = _models.Count % maxPerQuery > 0
                ? new ODataValue<List<Asset>>[requestCount + 1]
                : new ODataValue<List<Asset>>[requestCount];
            var index = 0;
            for (var i = 0; i < values.Length; i++)
            {
                values[i] = new ODataValue<List<Asset>>
                {
                    Value = _models.Skip(index).Take(maxPerQuery).ToList()
                };
                index += maxPerQuery;
            }

            var tasks = values.Select(async (value, i) =>
            {
                var sb = new StringBuilder("/api/v1/Assets?$filter=");
                foreach (var model in value.Value)
                {
                    sb.Append($"{nameof(Asset.Name)} eq '{model.Name}' or ");
                }

                var requestUri = new Uri(sb.ToString().TrimEnd(' ', 'o', 'r'), Relative);
                using var response = await client.GetAsync(requestUri).ConfigureAwait(false);
                response.EnsureSuccessStatusCode();
                var body = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                return Deserialize<ODataValue<List<Asset>>>(body, JsonSerializerOptions);
            });

            // Act
            values = await Task.WhenAll(tasks).ConfigureAwait(false);

            // Assert
            index = 0;
            foreach (var value in values)
            {
                foreach (var model in value.Value)
                {
                    Assert.Equal(_models[index].Id, model.Id);
                    Assert.Equal(_models[index].Name, model.Name);
                    Assert.Equal(_models[index].CreatedDate, model.CreatedDate.ToUniversalTime(), FromMilliseconds(1));
                    if (updated)
                    {
                        Assert.NotNull(model.UpdatedDate);
                    }
                    else
                    {
                        Assert.Null(model.UpdatedDate);
                    }

                    index++;
                }
            }

            return index;
        }
    }
}
