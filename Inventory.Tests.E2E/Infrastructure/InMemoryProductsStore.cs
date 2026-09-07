namespace Inventory.Tests.E2E.Infrastructure;

using System.Collections.Concurrent;

public sealed class InMemoryProductsStore
{
    private readonly ConcurrentDictionary<Guid, CatalogProductRecord> _catalogProducts = new();
    private readonly ConcurrentDictionary<Guid, InventoryItemRecord> _items = new();

    public sealed record CatalogProductRecord(
        Guid Id,
        string? Name,
        string? Brand,
        string? ModelNumber,
        string? Category,
        string? ManualUrl,
        decimal? MsrpPrice,
        DateTimeOffset CreatedAt,
        DateTimeOffset? UpdatedAt);

    public sealed record InventoryItemRecord(
        Guid Id,
        Guid CatalogProductId,
        string? SerialNumber,
        string? PurchaseDate,
        decimal? PricePaid,
        string? Description,
        DateTimeOffset CreatedAt,
        DateTimeOffset? UpdatedAt);

    public sealed record ProductRecord(
        Guid Id,
        Guid CatalogProductId,
        string? Name,
        string? Brand,
        string? ModelNumber,
        string? Category,
        string? ManualUrl,
        decimal? MsrpPrice,
        string? SerialNumber,
        string? PurchaseDate,
        decimal? PricePaid,
        string? Description,
        DateTimeOffset CreatedAt,
        DateTimeOffset? UpdatedAt);

    public IReadOnlyList<ProductRecord> GetProducts(string? nameFilter = null)
    {
        var all = _items.Values.Select(Merge);
        if (!string.IsNullOrWhiteSpace(nameFilter))
        {
            all = all.Where(p => p.Name?.Contains(nameFilter, StringComparison.OrdinalIgnoreCase) == true);
        }

        return [.. all.OrderBy(p => p.Name, StringComparer.Ordinal)];
    }

    public ProductRecord? GetProduct(Guid id) =>
        _items.TryGetValue(id, out var item) ? Merge(item) : null;

    public ProductRecord Create(
        string? name,
        decimal? price = null,
        string? brand = null,
        string? modelNumber = null,
        string? serialNumber = null,
        string? purchaseDate = null,
        string? category = null,
        string? description = null,
        string? manualUrl = null,
        decimal? msrpPrice = null)
    {
        var catalogProduct = FindOrCreateCatalogProduct(name, brand, modelNumber, category, manualUrl, msrpPrice);
        var item = new InventoryItemRecord(
            Guid.NewGuid(),
            catalogProduct.Id,
            serialNumber,
            purchaseDate,
            price,
            description,
            DateTimeOffset.UtcNow,
            null);
        _items[item.Id] = item;
        return Merge(item);
    }

    public ProductRecord? PatchItem(
        Guid id,
        string? serialNumber = null,
        string? purchaseDate = null,
        decimal? pricePaid = null,
        string? description = null)
    {
        if (!_items.TryGetValue(id, out var existing))
        {
            return null;
        }

        var updated = existing with
        {
            SerialNumber = serialNumber ?? existing.SerialNumber,
            PurchaseDate = purchaseDate ?? existing.PurchaseDate,
            PricePaid = pricePaid ?? existing.PricePaid,
            Description = description ?? existing.Description,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        _items[id] = updated;
        return Merge(updated);
    }

    public CatalogProductRecord? PatchCatalogProduct(
        Guid catalogProductId,
        string? name = null,
        string? brand = null,
        string? modelNumber = null,
        string? category = null,
        string? manualUrl = null,
        decimal? msrpPrice = null)
    {
        if (!_catalogProducts.TryGetValue(catalogProductId, out var existing))
        {
            return null;
        }

        var updated = existing with
        {
            Name = name ?? existing.Name,
            Brand = brand ?? existing.Brand,
            ModelNumber = modelNumber ?? existing.ModelNumber,
            Category = category ?? existing.Category,
            ManualUrl = manualUrl ?? existing.ManualUrl,
            MsrpPrice = msrpPrice ?? existing.MsrpPrice,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        _catalogProducts[catalogProductId] = updated;
        return updated;
    }

    public bool Delete(Guid id) => _items.TryRemove(id, out _);

    public void Clear()
    {
        _items.Clear();
        _catalogProducts.Clear();
    }

    private static string? MatchKey(string? brand, string? modelNumber) =>
        string.IsNullOrWhiteSpace(brand) || string.IsNullOrWhiteSpace(modelNumber)
            ? null
            : $"{brand.Trim().ToUpperInvariant()}::{modelNumber.Trim().ToUpperInvariant()}";

    private CatalogProductRecord FindOrCreateCatalogProduct(
        string? name,
        string? brand,
        string? modelNumber,
        string? category,
        string? manualUrl,
        decimal? msrpPrice)
    {
        var matchKey = MatchKey(brand, modelNumber);
        if (matchKey is not null)
        {
            var existing = _catalogProducts.Values
                .FirstOrDefault(c => string.Equals(MatchKey(c.Brand, c.ModelNumber), matchKey, StringComparison.Ordinal));
            if (existing is not null)
            {
                return existing;
            }
        }

        var created = new CatalogProductRecord(
            Guid.NewGuid(),
            name,
            brand,
            modelNumber,
            category,
            manualUrl,
            msrpPrice,
            DateTimeOffset.UtcNow,
            null);
        _catalogProducts[created.Id] = created;
        return created;
    }

    private ProductRecord Merge(InventoryItemRecord item)
    {
        _catalogProducts.TryGetValue(item.CatalogProductId, out var catalogProduct);
        return new ProductRecord(
            item.Id,
            item.CatalogProductId,
            catalogProduct?.Name,
            catalogProduct?.Brand,
            catalogProduct?.ModelNumber,
            catalogProduct?.Category,
            catalogProduct?.ManualUrl,
            catalogProduct?.MsrpPrice,
            item.SerialNumber,
            item.PurchaseDate,
            item.PricePaid,
            item.Description,
            item.CreatedAt,
            item.UpdatedAt);
    }
}
