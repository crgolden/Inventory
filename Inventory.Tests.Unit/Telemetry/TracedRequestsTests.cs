namespace Inventory.Tests.Unit.Telemetry;

using Inventory.Telemetry;
using Microsoft.AspNetCore.Http;

[Trait("Category", "Unit")]
public sealed class TracedRequestsTests
{
    public static TheoryData<string> DeclaredStaticAssetExtensions() =>
        [.. TracedRequests.StaticAssetExtensions];

    [Theory]
    [MemberData(nameof(DeclaredStaticAssetExtensions))]
    public void ShouldTrace_IsFalseForAStaticAsset(string extension)
    {
        Assert.False(TracedRequests.ShouldTrace(ContextFor(HashedAssetPath(extension))));
    }

    [Fact]
    public void ShouldTrace_IsFalseWhenTheExtensionIsUppercased()
    {
        Assert.False(TracedRequests.ShouldTrace(ContextFor(HashedAssetPath(".JS"))));
    }

    [Theory]
    [InlineData("")]
    [InlineData("/ready")]
    public void ShouldTrace_IsFalseForTheHealthProbe(string suffix)
    {
        var path = $"{TracedRequests.HealthPathPrefix}{suffix}";

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

    [Fact]
    public void ShouldTrace_IsTrueForAPathThatMerelyContainsAnExtensionMidway()
    {
        var path = $"/{Token()}/manual.js/{Token()}";

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
