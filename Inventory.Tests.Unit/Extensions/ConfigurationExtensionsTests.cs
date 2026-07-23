namespace Inventory.Tests.Unit.Extensions;

using System.Collections.Generic;
using Inventory.Extensions;
using Microsoft.Extensions.Configuration;

[Trait("Category", "Unit")]
public sealed class ConfigurationExtensionsTests
{
    [Fact]
    public void GetRequired_ReturnsValue_WhenKeyExists()
    {
        IConfiguration config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["MyKey"] = "expected" })
            .Build();

        Assert.Equal((string?)"expected", (string?)config.GetRequired<string>("MyKey"));
    }

    [Fact]
    public void GetRequired_ThrowsWithKeyNameInMessage_WhenKeyIsMissing()
    {
        IConfiguration config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var ex = Assert.Throws<InvalidOperationException>(() => config.GetRequired<string>("MissingKey"));
        Assert.Equal("Invalid 'MissingKey'.", ex.Message);
    }
}
