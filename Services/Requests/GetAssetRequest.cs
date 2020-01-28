namespace Inventory.Requests
{
    using System;
    using Common;
    using MediatR;
    using static System.String;

    public class GetAssetRequest : IRequest<Asset>, INameable
    {
        public GetAssetRequest(string name, Guid id)
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
        }

        public string Name { get; }

        public Guid Id { get; }
    }
}
