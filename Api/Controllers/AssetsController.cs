namespace Assets.Controllers
{
    using System;
    using System.Collections.Generic;
    using System.ComponentModel.DataAnnotations;
    using System.Linq;
    using System.Linq.Expressions;
    using System.Threading;
    using System.Threading.Tasks;
    using Common;
    using Microsoft.AspNet.OData;
    using Microsoft.AspNet.OData.Query;
    using Microsoft.AspNet.OData.Routing;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.Extensions.Logging;
    using Microsoft.OData;
    using Swashbuckle.AspNetCore.Annotations;
    using static System.String;
    using static Microsoft.AspNetCore.Http.StatusCodes;

    [ODataRoutePrefix("Assets")]
    public class AssetsController : ODataController
    {
        private readonly ILogger<AssetsController> _logger;
        private readonly IDataQueryService _dataQueryService;
        private readonly IDataCommandService _dataCommandService;

        public AssetsController(
            ILogger<AssetsController> logger,
            IEnumerable<IDataQueryService> dataQueryServices,
            IEnumerable<IDataCommandService> dataCommandServices)
        {
            _logger = logger;
            _dataQueryService = dataQueryServices.Single(x => x.Name == nameof(MongoDB));
            _dataCommandService = dataCommandServices.Single(x => x.Name == nameof(MongoDB));
        }

        [ODataRoute(RouteName = nameof(GetAssets))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status200OK, "Get Assets", typeof(ODataValue<List<Asset>>))]
        public async Task<IActionResult> GetAssets(ODataQueryOptions<Asset> options, CancellationToken cancellationToken)
        {
            IActionResult result;
            try
            {
                var query = _dataQueryService.Query<Asset>();
                query = options?.ApplyTo(query) as IQueryable<Asset> ?? query;
                var models = await _dataQueryService.ToListAsync(query, cancellationToken).ConfigureAwait(false);
                result = Ok(models);
            }
            catch (ODataException e)
            {
                result = BadRequest(e.Message);
            }
            catch (ArgumentException e) when (!IsNullOrEmpty(e.ParamName) && !IsNullOrWhiteSpace(e.ParamName))
            {
                ModelState.AddModelError(e.ParamName, e.Message);
                result = BadRequest(ModelState);
            }
            catch (ArgumentException e)
            {
                result = BadRequest(e.Message);
            }

            return result;
        }

        [ODataRoute(RouteName = nameof(PostAssets))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status200OK, "Create Assets", typeof(List<Asset>))]
        public async Task<IActionResult> PostAssets([FromBody, Required] List<Asset> models, CancellationToken cancellationToken)
        {
            IActionResult result;
            if (models == default || models.Count == 0)
            {
                ModelState.AddModelError(nameof(models), "Models are required");
                result = BadRequest(ModelState);
            }
            else if (models.Any(x => x.Id != default))
            {
                ModelState.AddModelError(nameof(models), "Ids must be empty");
                result = BadRequest(ModelState);
            }
            else
            {
                try
                {
                    var response = await _dataCommandService.CreateRangeAsync(models, cancellationToken).ConfigureAwait(false);
                    await _dataCommandService.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                    result = Ok(response.ToList());
                }
                catch (ArgumentException e) when (!IsNullOrEmpty(e.ParamName) && !IsNullOrWhiteSpace(e.ParamName))
                {
                    ModelState.AddModelError(e.ParamName, e.Message);
                    result = BadRequest(ModelState);
                }
                catch (ArgumentException e)
                {
                    result = BadRequest(e.Message);
                }
            }

            return result;
        }

        [ODataRoute(RouteName = nameof(PutAssets))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status204NoContent, "Update Assets")]
        public async Task<IActionResult> PutAssets([FromBody] List<Asset> models, CancellationToken cancellationToken)
        {
            IActionResult result;
            if (models == default || models.Count == 0)
            {
                ModelState.AddModelError(nameof(models), "Models are required");
                result = BadRequest(ModelState);
            }
            else
            {
                var keyValuePairs = models.ToDictionary<Asset, Expression<Func<Asset, bool>>, Asset>(x => y => y.Id == x.Id, x => x);
                try
                {
                    await _dataCommandService.UpdateRangeAsync(keyValuePairs, cancellationToken).ConfigureAwait(false);
                    await _dataCommandService.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                    result = NoContent();
                }
                catch (ArgumentException e) when (!IsNullOrEmpty(e.ParamName) && !IsNullOrWhiteSpace(e.ParamName))
                {
                    ModelState.AddModelError(e.ParamName, e.Message);
                    result = BadRequest(ModelState);
                }
                catch (ArgumentException e)
                {
                    result = BadRequest(e.Message);
                }
            }

            return result;
        }

        [ODataRoute(RouteName = nameof(DeleteAssets))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status204NoContent, "Delete Assets")]
        public async Task<IActionResult> DeleteAssets([FromQuery] Guid[] ids, CancellationToken cancellationToken)
        {
            IActionResult result;
            if (ids == default || ids.Length == 0)
            {
                ModelState.AddModelError(nameof(ids), "Ids are required");
                result = BadRequest(ModelState);
            }
            else
            {
                var keyValuePairs = ids.ToDictionary<Guid, Expression<Func<Asset, bool>>, Asset>(x => y => y.Id == x, x => new Asset());
                try
                {
                    await _dataCommandService.DeleteRangeAsync(keyValuePairs, cancellationToken).ConfigureAwait(false);
                    await _dataCommandService.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                    result = NoContent();
                }
                catch (ArgumentException e) when (!IsNullOrEmpty(e.ParamName) && !IsNullOrWhiteSpace(e.ParamName))
                {
                    ModelState.AddModelError(e.ParamName, e.Message);
                    result = BadRequest(ModelState);
                }
                catch (ArgumentException e)
                {
                    result = BadRequest(e.Message);
                }
            }

            return result;
        }
    }
}
