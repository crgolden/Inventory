namespace Inventory.Tests.Unit.Authentication;

using Inventory.Authentication;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.DependencyInjection;

[Trait("Category", "Unit")]
public sealed class ListeningAddressTests
{
    [Fact]
    public void CallbackUri_PrefersTheHttpsAddress_WhenTheServerListensOnBoth()
    {
        // Arrange
        var httpsAddress = HttpsAddress();
        var callbackPath = Generated.NewCallbackPath();

        // Act
        var callbackUri = ListeningAddress.CallbackUri([HttpAddress(), httpsAddress], callbackPath);

        // Assert
        Assert.Equal(httpsAddress + callbackPath, callbackUri);
    }

    [Fact]
    public void CallbackUri_FallsBackToTheFirstAddress_WhenNoneIsHttps()
    {
        // Arrange
        var firstAddress = HttpAddress();
        var callbackPath = Generated.NewCallbackPath();

        // Act
        var callbackUri = ListeningAddress.CallbackUri([firstAddress, HttpAddress()], callbackPath);

        // Assert
        Assert.Equal(firstAddress + callbackPath, callbackUri);
    }

    [Fact]
    public void CallbackUri_DropsTheAddressTrailingSlash()
    {
        // Arrange
        var httpsAddress = HttpsAddress();
        var callbackPath = Generated.NewCallbackPath();

        // Act
        var callbackUri = ListeningAddress.CallbackUri([httpsAddress + '/'], callbackPath);

        // Assert
        Assert.Equal(httpsAddress + callbackPath, callbackUri);
    }

    [Fact]
    public void CallbackUri_IsNull_WhenTheServerReportsNoAddress()
    {
        // Act
        var callbackUri = ListeningAddress.CallbackUri([], Generated.NewCallbackPath());

        // Assert
        Assert.Null(callbackUri);
    }

    [Fact]
    public void CallbackUri_ReadsTheAddressesTheRequestsServerListensOn()
    {
        // Arrange
        var httpsAddress = HttpsAddress();
        var callbackPath = Generated.NewCallbackPath();
        var addressesFeature = new ServerAddressesFeature();
        addressesFeature.Addresses.Add(httpsAddress);
        var features = new FeatureCollection();
        features.Set<IServerAddressesFeature>(addressesFeature);
        var context = new DefaultHttpContext
        {
            RequestServices = new ServiceCollection().AddSingleton<IServer>(new ListeningServer(features)).BuildServiceProvider(),
        };

        // Act
        var callbackUri = ListeningAddress.CallbackUri(context, callbackPath);

        // Assert
        Assert.Equal(httpsAddress + callbackPath, callbackUri);
    }

    private static string HttpsAddress() => $"{ListeningAddress.HttpsPrefix}{Generated.NewHost()}:{Generated.NewPortNumber()}";

    private static string HttpAddress() => $"{Uri.UriSchemeHttp}{Uri.SchemeDelimiter}{Generated.NewHost()}:{Generated.NewPortNumber()}";

    private sealed class ListeningServer(IFeatureCollection features) : IServer
    {
        public IFeatureCollection Features { get; } = features;

        public Task StartAsync<TContext>(IHttpApplication<TContext> application, CancellationToken cancellationToken)
            where TContext : notnull => Task.CompletedTask;

        public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

        public void Dispose()
        {
        }
    }
}
