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

    [Fact]
    public void GetInventorySecrets_ReadsCorrectConfigurationKeys()
    {
        IConfiguration config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["InventoryClientId"] = "client-id",
                ["InventoryClientSecret"] = "client-secret",
            })
            .Build();

        var (id, secret) = config.GetInventorySecrets();

        Assert.Equal((string?)"client-id", (string?)id);
        Assert.Equal((string?)"client-secret", (string?)secret);
    }
}
