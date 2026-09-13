namespace Inventory.Tests.Unit.Telemetry;

using Inventory.Telemetry;
using Microsoft.AspNetCore.Http;

[Trait("Category", "Unit")]
public sealed class TracedRequestsTests
{
    public static TheoryData<string> DeclaredStaticAssetExtensions() =>
        [.. TracedRequests.StaticAssetExtensions];

    public static TheoryData<string> UppercasedStaticAssetExtensions() =>
        [.. TracedRequests.StaticAssetExtensions.Select(extension => extension.ToUpperInvariant())];

    [Theory]
    [MemberData(nameof(DeclaredStaticAssetExtensions))]
    public void ShouldTrace_IsFalseForAStaticAsset(string extension)
    {
        Assert.False(TracedRequests.ShouldTrace(ContextFor(HashedAssetPath(extension))));
    }

    [Theory]
    [MemberData(nameof(UppercasedStaticAssetExtensions))]
    public void ShouldTrace_IsFalseWhenTheExtensionIsUppercased(string extension)
    {
        Assert.False(TracedRequests.ShouldTrace(ContextFor(HashedAssetPath(extension))));
    }

    [Fact]
    public void ShouldTrace_IsFalseForTheHealthPrefixItself()
    {
        Assert.False(TracedRequests.ShouldTrace(ContextFor(TracedRequests.HealthPathPrefix)));
    }

    [Fact]
    public void ShouldTrace_IsFalseForAPathBeneathTheHealthPrefix()
    {
        var path = $"{TracedRequests.HealthPathPrefix}/{Token()}";

        Assert.False(TracedRequests.ShouldTrace(ContextFor(path)));
    }

    [Fact]
    public void ShouldTrace_IsTrueForApplicationTraffic()
    {
        var path = $"/{Token()}/{Token()}";

        Assert.True(TracedRequests.ShouldTrace(ContextFor(path)));
    }

    [Fact]
    public void ShouldTrace_IsTrueForTheRootPath()
    {
        Assert.True(TracedRequests.ShouldTrace(ContextFor("/")));
    }

    [Theory]
    [MemberData(nameof(DeclaredStaticAssetExtensions))]
    public void ShouldTrace_IsTrueForAPathThatMerelyContainsAnExtensionMidway(string extension)
    {
        var path = $"/{Token()}/{Token()}{extension}/{Token()}";

        Assert.True(TracedRequests.ShouldTrace(ContextFor(path)));
    }

    [Fact]
    public void ShouldTrace_IsTrueForAnEmptyPath()
    {
        Assert.True(TracedRequests.ShouldTrace(new DefaultHttpContext()));
    }

    private static string Token() => Guid.NewGuid().ToString("N");

    private static string HashedAssetPath(string extension) => $"/{Token()}-{Token()}{extension}";

    private static HttpContext ContextFor(string path)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = new PathString(path);
        return context;
    }
}
