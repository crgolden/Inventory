namespace Inventory.Requests
{
    using System;
    using System.Collections.Generic;
    using Common;
    using MediatR;
    using static System.String;

    public class GetAssetRequest : IRequest<Asset>, INameable
    {
        public GetAssetRequest(string name, object[] keyValues)
        {
            if (IsNullOrWhiteSpace(name))
            {
                throw new ArgumentNullException(nameof(name));
            }

            Name = name;
            KeyValues = keyValues ?? throw new ArgumentNullException(nameof(keyValues));
        }

        public string Name { get; }

        public IReadOnlyCollection<object> KeyValues { get; }
    }
}
