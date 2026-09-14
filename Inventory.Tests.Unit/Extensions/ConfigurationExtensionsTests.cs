namespace Inventory.Tests.Unit.Extensions;

using System.Collections.Generic;
using Inventory.Extensions;
using Microsoft.Extensions.Configuration;
using static Inventory.Tests.Unit.TestSupport.TestValues;

[Trait("Category", "Unit")]
public sealed class ConfigurationExtensionsTests
{
    [Fact]
    public void GetRequired_ReturnsValue_WhenKeyExists()
    {
        var settingKey = NewSettingToken();
        var settingValue = NewSettingToken();
        IConfiguration config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [settingKey] = settingValue })
            .Build();

        Assert.Equal(settingValue, config.GetRequired<string>(settingKey));
    }

    [Fact]
    public void GetRequired_ThrowsWithKeyNameInMessage_WhenKeyIsMissing()
    {
        var missingKey = NewSettingToken();
        IConfiguration config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var ex = Assert.Throws<InvalidOperationException>(() => config.GetRequired<string>(missingKey));

        Assert.Equal($"Invalid '{missingKey}'.", ex.Message);
    }
}