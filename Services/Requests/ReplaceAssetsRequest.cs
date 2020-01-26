namespace Inventory.Requests
{
    using System;
    using System.Collections.Generic;
    using Common;
    using MediatR;
    using static System.String;

    public class ReplaceAssetsRequest : IRequest, INameable
    {
        public ReplaceAssetsRequest(string name, Asset[] assets)
        {
            if (IsNullOrWhiteSpace(name))
            {
                throw new ArgumentNullException(nameof(name));
            }

            Name = name;
            Assets = assets ?? throw new ArgumentNullException(nameof(assets));
        }

        public string Name { get; }

        public IReadOnlyCollection<Asset> Assets { get; }
    }
}
