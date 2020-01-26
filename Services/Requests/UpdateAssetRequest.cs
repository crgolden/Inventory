namespace Inventory.Requests
{
    using System;
    using Common;
    using MediatR;
    using Microsoft.AspNet.OData;
    using static System.String;

    public class UpdateAssetRequest : IRequest<Asset>, INameable
    {
        public UpdateAssetRequest(string name, Guid id, Delta<Asset> delta)
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
            Delta = delta ?? throw new ArgumentNullException(nameof(delta));
        }

        public string Name { get; }

        public Guid Id { get; }

        public Delta<Asset> Delta { get; }
    }
}
