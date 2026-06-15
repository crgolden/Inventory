namespace Inventory.Extensions;

public static class ConfigurationExtensions
{
    extension(IConfiguration configuration)
    {
        public T GetRequired<T>(string key)
            where T : notnull
        {
            return configuration.GetValue<T?>(key) ?? throw new InvalidOperationException($"Invalid '{key}'.");
        }

#pragma warning disable SA1009
        internal (
            string InventoryClientId,
            string InventoryClientSecret
        ) GetInventorySecrets()
        {
            var inventoryClientId = configuration.GetRequired<string>("InventoryClientId");
            var inventoryClientSecret = configuration.GetRequired<string>("InventoryClientSecret");
            return (
                inventoryClientId,
                inventoryClientSecret
            );
        }
#pragma warning restore SA1009
    }
}
