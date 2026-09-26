namespace Inventory.Authentication;

using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http.Features;

internal static class ListeningAddress
{
    internal const string HttpsPrefix = "https://";

    internal static string? CallbackUri(HttpContext context, PathString callbackPath) =>
        CallbackUri(
            context.RequestServices.GetRequiredService<IServer>().Features.GetRequiredFeature<IServerAddressesFeature>().Addresses,
            callbackPath);

    internal static string? CallbackUri(IEnumerable<string> serverAddresses, PathString callbackPath)
    {
        var addresses = serverAddresses.ToList();
        var address = addresses.FirstOrDefault(a => a.StartsWith(HttpsPrefix, StringComparison.OrdinalIgnoreCase)) ?? addresses.FirstOrDefault();
        return IsNullOrWhiteSpace(address) ? null : address.TrimEnd('/') + callbackPath;
    }
}
