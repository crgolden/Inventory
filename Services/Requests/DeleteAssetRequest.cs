namespace Inventory.Requests
{
    using System;
    using Common;
    using MediatR;
    using static System.String;

    public class DeleteAssetRequest : IRequest, INameable
    {
        public DeleteAssetRequest(string name, Guid id)
        {
            if (IsNullOrWhiteSpace(name))
            {
                throw new ArgumentNullException(nameof(name));
            }

            if (id == default)
            {
                throw new ArgumentException("Invalid Id", nameof(id));
            }

            Name = name;
            Id = id;
        }

        public string Name { get; }

        public Guid Id { get; }
    }
}