﻿namespace Inventory.Api.IntegrationTests
{
    using System;
    using System.Diagnostics;
    using System.Net;
    using System.Net.Http;
    using System.Security.Claims;
    using System.Text.Encodings.Web;
    using System.Text.Json;
    using System.Threading.Tasks;
    using Microsoft.AspNetCore.Authentication;
    using Microsoft.AspNetCore.Authentication.JwtBearer;
    using Microsoft.AspNetCore.Mvc.Testing;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;
    using Moq;
    using StackExchange.Redis;
    using Xunit;
    using Xunit.Abstractions;
    using static System.Console;
    using static System.Guid;
    using static System.Net.HttpStatusCode;
    using static System.Net.Mime.MediaTypeNames.Application;
    using static System.Security.Claims.ClaimTypes;
    using static System.Text.Encoding;
    using static System.Text.Json.JsonNamingPolicy;
    using static System.Text.Json.JsonSerializer;
    using static System.TimeSpan;
    using static System.UriKind;
    using static Microsoft.IdentityModel.JsonWebTokens.JwtRegisteredClaimNames;
    using static Models.ClassMaps;
    using static Models.IndexModels;
    using static Moq.Times;

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
            var userId = NewGuid();
            var database = new Mock<IDatabase>();
            _factory = _factory.WithWebHostBuilder(webHost =>
            {
                webHost.ConfigureAppConfiguration((context, configuration) =>
                {
                    configuration.AddEnvironmentVariables("ASPNETCORE");
                }).ConfigureServices((context, services) =>
                {
                    var redis = new Mock<IConnectionMultiplexer>();
                    redis.Setup(x => x.GetDatabase(It.IsAny<int>(), It.IsAny<object>())).Returns(database.Object);
                    services.AddSingleton(redis.Object);
                    services.AddTransient<JwtBearerHandler, TestAuthenticationHandler>(sp =>
                    {
                        var claims = new[]
                        {
                            new Claim(Role, "User"),
                            new Claim(Sub, userId.ToString())
                        };
                        return new TestAuthenticationHandler(
                            claims,
                            sp.GetRequiredService<IOptionsMonitor<JwtBearerOptions>>(),
                            sp.GetRequiredService<ILoggerFactory>(),
                            sp.GetRequiredService<UrlEncoder>(),
                            sp.GetRequiredService<ISystemClock>());
                    });
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
            var message = $"Model created in   {stopwatch.Elapsed}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(true);

            // Assert
            Assert.NotEqual(Empty, result.Id);
            Assert.Equal(model.Name, result.Name);
            Assert.Equal(userId, result.CreatedBy);
            Assert.Equal(model.CreatedDate, result.CreatedDate.ToUniversalTime());
            Assert.Null(result.UpdatedBy);
            Assert.Null(result.UpdatedDate);

            // Arrange
            model.Id = result.Id;
            model.CreatedBy = result.CreatedBy;
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
            message = $"Model retrieved in {stopwatch.Elapsed}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(true);

            // Assert
            Assert.Equal(model.Id, result.Id);
            Assert.Equal(model.Name, result.Name);
            Assert.Equal(userId, result.CreatedBy);
            Assert.Equal(model.CreatedDate, result.CreatedDate.ToUniversalTime(), FromMilliseconds(1));
            Assert.Null(result.UpdatedBy);
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
            message = $"Model updated in   {stopwatch.Elapsed}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(true);

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
            message = $"Model retrieved in {stopwatch.Elapsed}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(true);

            // Assert
            Assert.Equal(model.Id, result.Id);
            Assert.Equal(model.Name, result.Name);
            Assert.Equal(userId, result.CreatedBy);
            Assert.Equal(model.CreatedDate, result.CreatedDate.ToUniversalTime(), FromMilliseconds(1));
            Assert.Equal(userId, result.UpdatedBy);
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
            message = $"Model replaced in  {stopwatch.Elapsed}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(true);

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
            message = $"Model retrieved in {stopwatch.Elapsed}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(true);

            // Assert
            Assert.Equal(model.Id, result.Id);
            Assert.Equal(model.Name, result.Name);
            Assert.Equal(userId, result.CreatedBy);
            Assert.Equal(model.CreatedDate, result.CreatedDate.ToUniversalTime(), FromMilliseconds(1));
            Assert.Equal(userId, result.UpdatedBy);
            Assert.NotNull(result.UpdatedDate);

            // Arrange
            stopwatch.Restart();
            using (var response = await client.DeleteAsync(requestUri).ConfigureAwait(true))
            {
                response.EnsureSuccessStatusCode();
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            message = $"Model deleted in   {stopwatch.Elapsed}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(true);

            // Act
            stopwatch.Restart();
            HttpStatusCode statusCode;
            using (var response = await client.GetAsync(requestUri).ConfigureAwait(true))
            {
                statusCode = response.StatusCode;
            }

            stopwatch.Stop();
            total = total.Add(stopwatch.Elapsed);
            message = $"Model retrieved in {stopwatch.Elapsed}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(true);

            // Assert
            database.Verify(x => x.StringSetAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<TimeSpan?>(), It.IsAny<When>(), It.IsAny<CommandFlags>()), Exactly(3));
            database.Verify(x => x.KeyDeleteAsync(It.IsAny<RedisKey>(), It.IsAny<CommandFlags>()), Once);
            database.Verify(x => x.StringGetAsync(It.IsAny<RedisKey>(), It.IsAny<CommandFlags>()), Once);
            Assert.Equal(NotFound, statusCode);
            message = $"Finished all in    {total}";
            _output.WriteLine(message);
            await Out.WriteLineAsync(message).ConfigureAwait(true);
        }
    }
}
