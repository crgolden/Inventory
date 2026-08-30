namespace Inventory.Telemetry;

internal static class TracedRequests
{
    private static readonly string[] StaticAssetExtensions =
    [
        ".css", ".ico", ".jpg", ".jpeg", ".js", ".json", ".map", ".png", ".svg", ".webp", ".woff", ".woff2"
    ];

    public static bool ShouldTrace(HttpContext context)
    {
        var path = context.Request.Path;

        if (path.StartsWithSegments("/health", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var value = path.Value;

        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        return !StaticAssetExtensions.Any(extension => value.EndsWith(extension, StringComparison.OrdinalIgnoreCase));
    }
}
