namespace Inventory.Controllers
{
    using System;
    using System.Collections.Generic;
    using System.ComponentModel.DataAnnotations;
    using System.Linq;
    using System.Text.Json;
    using System.Threading;
    using System.Threading.Tasks;
    using MediatR;
    using Microsoft.AspNet.OData;
    using Microsoft.AspNet.OData.Query;
    using Microsoft.AspNet.OData.Routing;
    using Microsoft.AspNetCore.Mvc;
    using Requests;
    using Swashbuckle.AspNetCore.Annotations;
    using static Asset;
    using static Microsoft.AspNetCore.Http.StatusCodes;

    [ODataRoutePrefix("Assets")]
    [SwaggerTag("Create, Read, Update, and Delete Assets")]
    public class AssetsController : ODataController
    {
        private readonly IMediator _mediator;

        public AssetsController(IMediator mediator) => _mediator = mediator;

        [ODataRoute(RouteName = nameof(GetAssets))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status200OK, "Assets retrieved successfully", typeof(ODataValue<List<Asset>>))]
        [SwaggerOperation(
            Summary = "Get Assets",
            OperationId = nameof(GetAssets),
            Tags = new[] { "Assets" }
        )]
        public async Task<IActionResult> GetAssets(
            [SwaggerParameter("The query options", Required = true), Required] ODataQueryOptions<Asset> options,
            CancellationToken cancellationToken)
        {
            var request = new GetAssetsRequest(nameof(MongoDB), options);
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

            var models = element.EnumerateArray().Select(FromJsonElement).ToArray();
            if (models.Any(x => x.Id != default))
            {
                ModelState.AddModelError(nameof(element), "Ids must be empty");
                return BadRequest(ModelState);
            }

            var request = new CreateAssetsRequest(nameof(MongoDB), models);
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

            var models = element.EnumerateArray().Select(FromJsonElement).ToArray();
            var request = new ReplaceAssetsRequest(nameof(MongoDB), models);
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

            var request = new DeleteAssetsRequest(nameof(MongoDB), ids);
            await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
            return NoContent();
        }
    }
}
