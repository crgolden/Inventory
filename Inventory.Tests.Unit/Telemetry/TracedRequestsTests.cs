namespace Inventory.Tests.Unit.Telemetry;

using Inventory.Telemetry;
using Microsoft.AspNetCore.Http;

[Trait("Category", "Unit")]
public sealed class TracedRequestsTests
{
    [Theory]
    [InlineData("/chunk-BlZ1Efuc.js")]
    [InlineData("/main-PSZ56RKK.js")]
    [InlineData("/styles-K6J5AP2Y.css")]
    [InlineData("/favicon.ico")]
    [InlineData("/media/bootstrap-icons-CVBWLLHT.woff2")]
    [InlineData("/MAIN-UPPERCASE.JS")]
    public void ShouldTrace_IsFalseForAStaticAsset(string path)
    {
        Assert.False(TracedRequests.ShouldTrace(ContextFor(path)));
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/health/ready")]
    public void ShouldTrace_IsFalseForTheHealthProbe(string path)
    {
        Assert.False(TracedRequests.ShouldTrace(ContextFor(path)));
    }

    [Theory]
    [InlineData("/products/api/odata/Products")]
    [InlineData("/bff/user")]
    [InlineData("/products/9182")]
    [InlineData("/")]
    public void ShouldTrace_IsTrueForRealApplicationTraffic(string path)
    {
        Assert.True(TracedRequests.ShouldTrace(ContextFor(path)));
    }

    [Fact]
    public void ShouldTrace_IsTrueForAPathThatMerelyContainsAnExtensionMidway()
    {
        Assert.True(TracedRequests.ShouldTrace(ContextFor("/products/manual.js/details")));
    }

    [Fact]
    public void ShouldTrace_IsTrueForAnEmptyPath()
    {
        Assert.True(TracedRequests.ShouldTrace(new DefaultHttpContext()));
    }

    private static HttpContext ContextFor(string path)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = new PathString(path);
        return context;
    }
}
