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
        // Arrange
        var settingKey = Generated.NewSettingToken();
        var settingValue = Generated.NewSettingToken();
        IConfiguration config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [settingKey] = settingValue })
            .Build();

        // Act
        var value = config.GetRequired<string>(settingKey);

        // Assert
        Assert.Equal(settingValue, value);
    }

    [Fact]
    public void GetRequired_ThrowsWithKeyNameInMessage_WhenKeyIsMissing()
    {
        // Arrange
        var missingKey = Generated.NewSettingToken();
        IConfiguration config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        // Act
        var exception = Record.Exception(() => config.GetRequired<string>(missingKey));

        // Assert
        var ex = Assert.IsType<InvalidOperationException>(exception);
        Assert.Contains(missingKey, ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void GetRequired_ThrowsRatherThanReturningZero_WhenAnIntKeyIsMissing()
    {
        // Arrange
        var missingKey = Generated.NewSettingToken();
        IConfiguration config = new ConfigurationBuilder().Build();

        // Act
        var exception = Record.Exception(() => config.GetRequired<int>(missingKey));

        // Assert
        var ex = Assert.IsType<InvalidOperationException>(exception);
        Assert.Contains(missingKey, ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void GetRequired_ThrowsRatherThanReturningFalse_WhenABoolKeyIsMissing()
    {
        // Arrange
        var missingKey = Generated.NewSettingToken();
        IConfiguration config = new ConfigurationBuilder().Build();

        // Act
        var exception = Record.Exception(() => config.GetRequired<bool>(missingKey));

        // Assert
        var ex = Assert.IsType<InvalidOperationException>(exception);
        Assert.Contains(missingKey, ex.Message, StringComparison.Ordinal);
    }
}
