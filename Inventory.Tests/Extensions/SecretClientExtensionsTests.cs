namespace Inventory.Tests.Extensions;

using System.Collections.Generic;
using System.Threading;
using Azure;
using Azure.Security.KeyVault.Secrets;
using Inventory.Extensions;
using Moq;

[Trait("Category", "Unit")]
public sealed class SecretClientExtensionsTests
{
    [Fact]
    public void GetInventorySecrets_ReturnsTupleWithAllFourSecretValues()
    {
        var values = new Dictionary<string, string>
        {
            ["ElasticsearchUsername"] = "es-user",
            ["ElasticsearchPassword"] = "es-pass",
            ["InventoryClientId"] = "client-id",
            ["InventoryClientSecret"] = "client-secret",
        };
        var mock = new Mock<SecretClient>();
        mock.Setup(c => c.GetSecret(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<SecretContentType?>(), It.IsAny<CancellationToken>()))
            .Returns<string, string?, SecretContentType?, CancellationToken>((name, _, _, _) => SecretResponse(name, values[name]));

        var (esUsername, esPassword, clientId, clientSecret) = mock.Object.GetInventorySecrets();

        Assert.Equal((string?)"es-user", (string?)esUsername.Value);
        Assert.Equal((string?)"es-pass", (string?)esPassword.Value);
        Assert.Equal((string?)"client-id", (string?)clientId.Value);
        Assert.Equal((string?)"client-secret", (string?)clientSecret.Value);
    }

    private static Response<KeyVaultSecret> SecretResponse(string name, string value) =>
        Response.FromValue(new KeyVaultSecret(name, value), Mock.Of<Response>());
}
