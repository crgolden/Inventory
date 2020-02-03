namespace Inventory.Controllers
{
    using System;
    using System.Collections.Generic;
    using System.ComponentModel.DataAnnotations;
    using System.Diagnostics.CodeAnalysis;
    using System.Linq;
    using System.Linq.Expressions;
    using System.Text.Json;
    using System.Threading;
    using System.Threading.Tasks;
    using Common;
    using Core.Requests;
    using MediatR;
    using Microsoft.AspNet.OData;
    using Microsoft.AspNet.OData.Query;
    using Microsoft.AspNet.OData.Routing;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.Extensions.Logging;
    using Microsoft.OData;
    using Swashbuckle.AspNetCore.Annotations;
    using static System.DateTime;
    using static System.StringComparison;
    using static Asset;
    using static Microsoft.AspNetCore.Http.StatusCodes;

    [ODataRoutePrefix("Assets")]
    [SwaggerTag("Create, Read, Update, and Delete Assets")]
    public class AssetsController : ODataController
    {
        private readonly IMediator _mediator;
        private readonly IDataQueryService _dataQueryService;
        private readonly ILogger<AssetsController> _logger;

        public AssetsController(
            IMediator mediator,
            IEnumerable<IDataQueryService> dataQueryServices,
            ILogger<AssetsController> logger)
        {
            _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
            _dataQueryService = (
                dataQueryServices ?? throw new ArgumentNullException(nameof(dataQueryServices))
            ).Single(x => string.Equals(nameof(MongoDB), x.Name, OrdinalIgnoreCase));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [ODataRoute(RouteName = nameof(GetAssets))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status200OK, "Assets retrieved successfully", typeof(ODataValue<List<Asset>>))]
        [SwaggerOperation(
            Summary = "Get Assets",
            OperationId = nameof(GetAssets),
            Tags = new[] { "Assets" }
        )]
        [SuppressMessage("Design", "CA1062:Validate arguments of public methods", Justification = "Checked by `Required` attribute")]
        public async Task<IActionResult> GetAssets(
            [SwaggerParameter("The query options", Required = true), Required] ODataQueryOptions<Asset> options,
            CancellationToken cancellationToken)
        {
            var query = _dataQueryService.Query<Asset>();
            try
            {
                query = (IQueryable<Asset>)options.ApplyTo(query);
            }
            catch (ODataException e)
            {
                ModelState.AddModelError(nameof(options), e.Message);
                return BadRequest(ModelState);
            }

            var request = new GetRangeRequest<Asset>(nameof(MongoDB), query, _logger);
            var response = await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
            return Ok(response);
        }

        [ODataRoute(RouteName = nameof(PostAssets))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status200OK, "Assets created successfully", typeof(ODataValue<List<Asset>>))]
        [SwaggerOperation(
            Summary = "Create Assets",
            OperationId = nameof(PostAssets),
            Tags = new[] { "Assets" }
        )]
        public async Task<IActionResult> PostAssets(
            [SwaggerParameter("The Assets", Required = true), FromBody, Required] JsonElement element,
            CancellationToken cancellationToken)
        {
            if (element.ValueKind != JsonValueKind.Array)
            {
                ModelState.AddModelError(nameof(element), "Models must be an array");
                return BadRequest(ModelState);
            }

            if (element.GetArrayLength() == 0)
            {
                ModelState.AddModelError(nameof(element), "Models cannot be empty");
                return BadRequest(ModelState);
            }

            var models = element.EnumerateArray().Select(FromJsonElement).ToList();
            if (models.Any(x => x.Id != default))
            {
                ModelState.AddModelError(nameof(element), "Ids must be empty");
                return BadRequest(ModelState);
            }

            var request = new CreateRangeRequest<Asset>(nameof(MongoDB), models, _logger);
            await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
            return Ok(models);
        }

        [ODataRoute(RouteName = nameof(PutAssets))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status204NoContent, "Assets replaced successfully")]
        [SwaggerOperation(
            Summary = "Replace Assets",
            OperationId = nameof(PutAssets),
            Tags = new[] { "Assets" }
        )]
        public async Task<IActionResult> PutAssets(
            [SwaggerParameter("The Assets", Required = true), FromBody, Required] JsonElement element,
            CancellationToken cancellationToken)
        {
            if (element.ValueKind != JsonValueKind.Array)
            {
                ModelState.AddModelError(nameof(element), "Models must be an array");
                return BadRequest(ModelState);
            }

            if (element.GetArrayLength() == 0)
            {
                ModelState.AddModelError(nameof(element), "Models cannot be empty");
                return BadRequest(ModelState);
            }

            var models = element.EnumerateArray().Select(FromJsonElement).ToList();
            models.ForEach(model => model.UpdatedDate = UtcNow);
            var keyValuePairs = models.ToDictionary(model => (Expression<Func<Asset, bool>>)(x => x.Id == model.Id), model => model);
            var request = new UpdateRangeRequest<Asset>(nameof(MongoDB), keyValuePairs, _logger);
            await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
            return NoContent();
        }

        [ODataRoute(RouteName = nameof(DeleteAssets))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status204NoContent, "Delete Assets")]
        [SwaggerOperation(
            Summary = "Delete Assets",
            OperationId = nameof(DeleteAssets),
            Tags = new[] { "Assets" }
        )]
        public async Task<IActionResult> DeleteAssets(
            [SwaggerParameter("The Asset Ids", Required = true), FromQuery, Required] Guid[] ids,
            CancellationToken cancellationToken)
        {
            if (ids == default || ids.Length == 0)
            {
                ModelState.AddModelError(nameof(ids), "Ids are required");
                return BadRequest(ModelState);
            }

            var expressions = ids.Select(id => (Expression<Func<Asset, bool>>)(asset => asset.Id == id));
            var request = new DeleteRangeRequest<Asset>(nameof(MongoDB), expressions.ToArray(), _logger);
            await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
            return NoContent();
        }
    }
}
