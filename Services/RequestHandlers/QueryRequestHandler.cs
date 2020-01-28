namespace Inventory.RequestHandlers
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading;
    using System.Threading.Tasks;
    using Common;
    using MediatR;
    using Requests;
    using static System.StringComparison;

    public class QueryRequestHandler : IRequestHandler<GetAssetsRequest, List<Asset>>
    {
        private readonly IEnumerable<IDataQueryService> _dataQueryServices;

        public QueryRequestHandler(IEnumerable<IDataQueryService> dataQueryServices)
        {
            _dataQueryServices = dataQueryServices;
        }

        public Task<List<Asset>> Handle(GetAssetsRequest request, CancellationToken cancellationToken)
        {
            if (request == default)
            {
                throw new ArgumentNullException(nameof(request));
            }

            var dataQueryService = _dataQueryServices.SingleOrDefault(x => string.Equals(request.Name, x.Name, InvariantCultureIgnoreCase));
            if (dataQueryService == default)
            {
                throw new InvalidOperationException($"Data Query Service not found for '{request.Name}'");
            }

            return dataQueryService.ToListAsync(request.Query, cancellationToken);
        }
    }
}
