namespace Inventory.Requests
{
    using System;
    using Common;
    using MediatR;
    using static System.String;

    public class ReplaceAssetRequest : IRequest, INameable
    {
        public ReplaceAssetRequest(string name, Guid id, Asset asset)
        {
            if (IsNullOrWhiteSpace(name))
            {
                throw new ArgumentNullException(nameof(name));
            }

            if (id == default)
            {
                throw new ArgumentException("Invalid id", nameof(id));
            }

            Name = name;
            Id = id;
            Asset = asset ?? throw new ArgumentNullException(nameof(asset));
        }

        public string Name { get; }

        public Guid Id { get; }

        public Asset Asset { get; }
    }
}
