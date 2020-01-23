namespace Assets.Requests
{
    using System;
    using System.Collections.Generic;
    using MediatR;
    using Microsoft.AspNet.OData.Query;
    using static System.String;

    public class GetAssetsRequest : IRequest<List<Asset>>
    {
        public GetAssetsRequest(string name, ODataQueryOptions<Asset> queryOptions)
        {
            if (IsNullOrWhiteSpace(name))
            {
                throw new ArgumentNullException(nameof(name));
            }

            Name = name;
            ODataQueryOptions = queryOptions ?? throw new ArgumentNullException(nameof(queryOptions));
        }

        public string Name { get; }

        public ODataQueryOptions<Asset> ODataQueryOptions { get; }
    }
}
