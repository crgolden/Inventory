namespace Inventory
{
    using System;
    using System.ComponentModel.DataAnnotations;
    using System.Text.Json;
    using static System.DateTime;

    public class Asset
    {
        public Asset()
        {
            CreatedDate = CreatedDate == default ? UtcNow : CreatedDate;
        }

        public Guid Id { get; set; }

        public DateTime CreatedDate { get; set; }

        public DateTime? UpdatedDate { get; set; }

        [StringLength(255)]
        public string Name { get; set; }

        public static Asset FromJsonElement(JsonElement element)
        {
            var asset = new Asset();
            if (element.ValueKind != JsonValueKind.Object)
            {
                throw new ArgumentException("Element must be an object", nameof(element));
            }

            foreach (var property in element.EnumerateObject())
            {
                var name = property.Name.ToUpperInvariant();
                if (nameof(Name).ToUpperInvariant() == name &&
                    property.Value.ValueKind == JsonValueKind.String)
                {
                    asset.Name = property.Value.ToString();
                }
                else if (nameof(CreatedDate).ToUpperInvariant() == name &&
                         property.Value.ValueKind == JsonValueKind.String &&
                         property.Value.TryGetDateTime(out var createdDate))
                {
                    asset.CreatedDate = createdDate;
                }
                else if (nameof(UpdatedDate).ToUpperInvariant() == name &&
                         property.Value.ValueKind == JsonValueKind.String &&
                         property.Value.TryGetDateTime(out var updatedDate))
                {
                    asset.UpdatedDate = updatedDate;
                }
                else if (nameof(Id).ToUpperInvariant() == name &&
                         property.Value.ValueKind == JsonValueKind.String &&
                         property.Value.TryGetGuid(out var id))
                {
                    asset.Id = id;
                }
            }

            return asset;
        }
    }
}
