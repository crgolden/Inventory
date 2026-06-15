namespace Inventory.Extensions;

using Azure.Security.KeyVault.Secrets;

public static class SecretClientExtensions
{
    extension(SecretClient secretClient)
    {
#pragma warning disable SA1009
        public (
            KeyVaultSecret ElasticsearchUsername,
            KeyVaultSecret ElasticsearchPassword,
            KeyVaultSecret InventoryClientId,
            KeyVaultSecret InventoryClientSecret
        ) GetInventorySecrets()
        {
            var elasticsearchUsername = secretClient.GetSecret("ElasticsearchUsername");
            var elasticsearchPassword = secretClient.GetSecret("ElasticsearchPassword");
            var inventoryClientId = secretClient.GetSecret("InventoryClientId");
            var inventoryClientSecret = secretClient.GetSecret("InventoryClientSecret");
            return (
                elasticsearchUsername.Value,
                elasticsearchPassword.Value,
                inventoryClientId.Value,
                inventoryClientSecret.Value
            );
        }
#pragma warning restore SA1009
    }
}