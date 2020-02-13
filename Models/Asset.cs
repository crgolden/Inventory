namespace Inventory
{
    using System;
    using System.ComponentModel.DataAnnotations;
    using System.Text.Json;
    using Common;
    using static System.DateTime;

    /// <summary>An asset.</summary>
    public class Asset : ICreatable<Guid>
    {
        /// <summary>Initializes a new instance of the <see cref="Asset"/> class.</summary>
        public Asset()
        {
            CreatedDate = CreatedDate == default ? UtcNow : CreatedDate;
        }

        /// <summary>Gets or sets the identifier.</summary>
        /// <value>The identifier.</value>
        public Guid Id { get; set; }

        /// <inheritdoc />
        public Guid CreatedBy { get; set; }

        /// <inheritdoc />
        public DateTime CreatedDate { get; set; }

        /// <summary>Gets or sets the updated by.</summary>
        /// <value>The updated by.</value>
        public Guid? UpdatedBy { get; set; }

        /// <summary>Gets or sets the updated date.</summary>
        /// <value>The updated date.</value>
        public DateTime? UpdatedDate { get; set; }

        /// <summary>Gets or sets the name.</summary>
        /// <value>The name.</value>
        [StringLength(255)]
        public string Name { get; set; }

        /// <summary>Maps a <see cref="JsonElement"/> to an <see cref="Asset"/>.</summary>
        /// <param name="element">The element.</param>
        /// <returns>A mapped <see cref="Asset"/>.</returns>
        /// <exception cref="ArgumentException"><paramref name="element"/> must be an object.</exception>
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
                else if (nameof(CreatedBy).ToUpperInvariant() == name &&
                         property.Value.ValueKind == JsonValueKind.String &&
                         property.Value.TryGetGuid(out var createdBy))
                {
                    asset.CreatedBy = createdBy;
                }
                else if (nameof(CreatedDate).ToUpperInvariant() == name &&
                         property.Value.ValueKind == JsonValueKind.String &&
                         property.Value.TryGetDateTime(out var createdDate))
                {
                    asset.CreatedDate = createdDate;
                }
                else if (nameof(UpdatedBy).ToUpperInvariant() == name &&
                         property.Value.ValueKind == JsonValueKind.String &&
                         property.Value.TryGetGuid(out var updatedBy))
                {
                    asset.UpdatedBy = updatedBy;
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
