namespace Inventory.Requests
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using Common;
    using MediatR;
    using Microsoft.Extensions.Logging;
    using static System.String;

    public class GetAssetsRequest : IRequest<List<Asset>>, INameable, IEventable
    {
        public GetAssetsRequest(string name, IQueryable<Asset> query)
        {
            if (IsNullOrWhiteSpace(name))
            {
                throw new ArgumentNullException(nameof(name));
            }

            Name = name;
            Query = query ?? throw new ArgumentNullException(nameof(query));
        }

        public EventId EventId => EventIds.Query;

        public string Name { get; }

        public IQueryable<Asset> Query { get; }

    }
}
