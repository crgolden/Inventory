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
        // Act
        var shouldTrace = TracedRequests.ShouldTrace(ContextFor(HashedAssetPath(extension)));

        // Assert
        Assert.False(shouldTrace);
    }

    [Theory]
    [MemberData(nameof(UppercasedStaticAssetExtensions))]
    public void ShouldTrace_IsFalseWhenTheExtensionIsUppercased(string extension)
    {
        // Act
        var shouldTrace = TracedRequests.ShouldTrace(ContextFor(HashedAssetPath(extension)));

        // Assert
        Assert.False(shouldTrace);
    }

    [Fact]
    public void ShouldTrace_IsFalseForTheHealthPrefixItself()
    {
        // Act
        var shouldTrace = TracedRequests.ShouldTrace(ContextFor(TracedRequests.HealthPathPrefix));

        // Assert
        Assert.False(shouldTrace);
    }

    [Fact]
    public void ShouldTrace_IsFalseForAPathBeneathTheHealthPrefix()
    {
        // Arrange
        var path = $"{TracedRequests.HealthPathPrefix}/{Token()}";

        // Act
        var shouldTrace = TracedRequests.ShouldTrace(ContextFor(path));

        // Assert
        Assert.False(shouldTrace);
    }

    [Fact]
    public void ShouldTrace_IsTrueForApplicationTraffic()
    {
        // Arrange
        var path = $"/{Token()}/{Token()}";

        // Act
        var shouldTrace = TracedRequests.ShouldTrace(ContextFor(path));

        // Assert
        Assert.True(shouldTrace);
    }

    [Fact]
    public void ShouldTrace_IsTrueForTheRootPath()
    {
        // Act
        var shouldTrace = TracedRequests.ShouldTrace(ContextFor("/"));

        // Assert
        Assert.True(shouldTrace);
    }

    [Theory]
    [MemberData(nameof(DeclaredStaticAssetExtensions))]
    public void ShouldTrace_IsTrueForAPathThatMerelyContainsAnExtensionMidway(string extension)
    {
        // Arrange
        var path = $"/{Token()}/{Token()}{extension}/{Token()}";

        // Act
        var shouldTrace = TracedRequests.ShouldTrace(ContextFor(path));

        // Assert
        Assert.True(shouldTrace);
    }

    [Fact]
    public void ShouldTrace_IsTrueForAnEmptyPath()
    {
        // Act
        var shouldTrace = TracedRequests.ShouldTrace(new DefaultHttpContext());

        // Assert
        Assert.True(shouldTrace);
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
