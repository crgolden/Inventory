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
        var settingKey = NewToken();
        var settingValue = NewToken();
        IConfiguration config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [settingKey] = settingValue })
            .Build();

        Assert.Equal(settingValue, config.GetRequired<string>(settingKey));
    }

    [Fact]
    public void GetRequired_ThrowsWithKeyNameInMessage_WhenKeyIsMissing()
    {
        var missingKey = NewToken();
        IConfiguration config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var ex = Assert.Throws<InvalidOperationException>(() => config.GetRequired<string>(missingKey));

        // The message format is the contract this test exists to pin, so the literal stays; only the key
        // is generated, which is what proves the key is interpolated rather than coincidentally present.
        Assert.Equal($"Invalid '{missingKey}'.", ex.Message);
    }

    private static string NewToken() => Guid.NewGuid().ToString("N");
}