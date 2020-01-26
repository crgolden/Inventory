namespace Inventory.Requests
{
    using System;
    using Common;
    using MediatR;
    using static System.String;

    public class CreateAssetRequest : IRequest, INameable
    {
        public CreateAssetRequest(string name, Asset asset)
        {
            if (IsNullOrWhiteSpace(name))
            {
                throw new ArgumentNullException(nameof(name));
            }

            Name = name;
            Asset = asset ?? throw new ArgumentNullException(nameof(asset));
        }

        public string Name { get; }

        public Asset Asset { get; }
    }
}