namespace Inventory.RequestHandlers
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Linq.Expressions;
    using System.Threading;
    using System.Threading.Tasks;
    using Common;
    using MediatR;
    using Requests;
    using static System.DateTime;
    using static System.StringComparison;
    using static MediatR.Unit;

    public class CommandRequestHandler :
        IRequestHandler<GetAssetRequest, Asset>,
        IRequestHandler<CreateAssetRequest>,
        IRequestHandler<UpdateAssetRequest, Asset>,
        IRequestHandler<ReplaceAssetRequest>,
        IRequestHandler<DeleteAssetRequest>,
        IRequestHandler<CreateAssetsRequest>,
        IRequestHandler<ReplaceAssetsRequest>,
        IRequestHandler<DeleteAssetsRequest>
    {
        private readonly IEnumerable<IDataCommandService> _dataCommandServices;

        public CommandRequestHandler(IEnumerable<IDataCommandService> dataCommandServices)
        {
            _dataCommandServices = dataCommandServices;
        }

        public Task<Asset> Handle(GetAssetRequest request, CancellationToken cancellationToken)
        {
            var dataCommandService = GetDataCommandService(request);
            return dataCommandService.GetAsync<Asset>(request.KeyValues.ToArray(), cancellationToken).AsTask();
        }

        public Task<Unit> Handle(CreateAssetRequest request, CancellationToken cancellationToken)
        {
            var dataCommandService = GetDataCommandService(request);

            async Task<Unit> Handle()
            {
                await dataCommandService.CreateAsync(request.Asset, cancellationToken).ConfigureAwait(false);
                await dataCommandService.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                return Value;
            }

            return Handle();
        }

        public Task<Asset> Handle(UpdateAssetRequest request, CancellationToken cancellationToken)
        {
            var dataCommandService = GetDataCommandService(request);

            async Task<Asset> Handle()
            {
                var model = await dataCommandService.GetAsync<Asset>(new object[] { request.Id }, cancellationToken).ConfigureAwait(false);
                if (model == default)
                {
                    throw new InvalidOperationException($"Model not found for Id: {request.Id}");
                }

                request.Delta.Patch(model);
                model.UpdatedDate = UtcNow;
                await dataCommandService.UpdateAsync(x => x.Id == request.Id, model, cancellationToken).ConfigureAwait(false);
                await dataCommandService.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                return model;
            }

            return Handle();
        }

        public Task<Unit> Handle(ReplaceAssetRequest request, CancellationToken cancellationToken)
        {
            var dataCommandService = GetDataCommandService(request);

            async Task<Unit> Handle()
            {
                request.Asset.UpdatedDate = UtcNow;
                await dataCommandService.UpdateAsync(x => x.Id == request.Id, request.Asset, cancellationToken).ConfigureAwait(false);
                await dataCommandService.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                return Value;
            }

            return Handle();
        }

        public Task<Unit> Handle(DeleteAssetRequest request, CancellationToken cancellationToken)
        {
            var dataCommandService = GetDataCommandService(request);

            async Task<Unit> Handle()
            {
                await dataCommandService.DeleteAsync<Asset>(x => x.Id == request.Id, cancellationToken).ConfigureAwait(false);
                await dataCommandService.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                return Value;
            }

            return Handle();
        }

        public Task<Unit> Handle(CreateAssetsRequest request, CancellationToken cancellationToken)
        {
            var dataCommandService = GetDataCommandService(request);

            async Task<Unit> Handle()
            {
                await dataCommandService.CreateRangeAsync(request.Assets, cancellationToken).ConfigureAwait(false);
                await dataCommandService.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                return Value;
            }

            return Handle();
        }

        public Task<Unit> Handle(ReplaceAssetsRequest request, CancellationToken cancellationToken)
        {
            var dataCommandService = GetDataCommandService(request);

            async Task<Unit> Handle()
            {
                foreach (var asset in request.Assets)
                {
                    asset.UpdatedDate = UtcNow;
                }

                var keyValuePairs = request.Assets.ToDictionary<Asset, Expression<Func<Asset, bool>>, Asset>(x => y => y.Id == x.Id, x => x);
                await dataCommandService.UpdateRangeAsync(keyValuePairs, cancellationToken).ConfigureAwait(false);
                await dataCommandService.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                return Value;
            }

            return Handle();
        }

        public Task<Unit> Handle(DeleteAssetsRequest request, CancellationToken cancellationToken)
        {
            var dataCommandService = GetDataCommandService(request);

            async Task<Unit> Handle()
            {
                var keyValuePairs = request.Ids.ToDictionary<Guid, Expression<Func<Asset, bool>>, Asset>(x => y => y.Id == x, x => new Asset());
                await dataCommandService.DeleteRangeAsync(keyValuePairs, cancellationToken).ConfigureAwait(false);
                await dataCommandService.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                return Value;
            }

            return Handle();
        }

        private IDataCommandService GetDataCommandService(INameable request)
        {
            if (request == default)
            {
                throw new ArgumentNullException(nameof(request));
            }

            var dataCommandService = _dataCommandServices.SingleOrDefault(x => string.Equals(request.Name, x.Name, InvariantCultureIgnoreCase));
            if (dataCommandService == default)
            {
                throw new InvalidOperationException($"Data Command Service not found for '{request.Name}'");
            }

            return dataCommandService;
        }
    }
}
