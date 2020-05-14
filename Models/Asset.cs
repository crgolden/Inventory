namespace Inventory
{
    using System;
    using System.ComponentModel.DataAnnotations;
    using System.Text.Json.Serialization;
    using Common;
    using static System.DateTime;

    /// <summary>An asset.</summary>
    public class Asset : IKeyable<Guid>, ICreatable<Guid>, INameable
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
        [JsonIgnore]
        public Guid Key => Id;

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
    }
}
