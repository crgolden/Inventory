namespace Inventory.Controllers
{
    using System;
    using System.ComponentModel.DataAnnotations;
    using System.Diagnostics.CodeAnalysis;
    using System.Threading;
    using System.Threading.Tasks;
    using Common;
    using Core.Requests;
    using MediatR;
    using Microsoft.AspNet.OData;
    using Microsoft.AspNet.OData.Routing;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.Extensions.Logging;
    using Swashbuckle.AspNetCore.Annotations;
    using static System.DateTime;
    using static Microsoft.AspNetCore.Http.StatusCodes;

    [ODataRoutePrefix("Asset")]
    [SwaggerTag("Create, Read, Update, and Delete Assets")]
    public class AssetController : ODataController
    {
        private readonly IMediator _mediator;
        private readonly ILogger<AssetController> _logger;

        public AssetController(IMediator mediator, ILogger<AssetController> logger)
        {
            _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [ODataRoute("({id})", RouteName = nameof(GetAsset))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status200OK, "Asset retrieved successfully", typeof(Asset))]
        [SwaggerOperation(
            Summary = "Get an Asset",
            OperationId = nameof(GetAsset),
            Tags = new[] { "Asset" }
        )]
        public async Task<IActionResult> GetAsset(
            [SwaggerParameter("The Asset Id", Required = true), FromODataUri, NotDefault] Guid id,
            CancellationToken cancellationToken)
        {
            var request = new GetRequest<Asset>(nameof(MongoDB), new object[] { id }, _logger);
            var model = await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
            return Ok(model);
        }

        [ODataRoute(RouteName = nameof(PostAsset))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status201Created, "Asset created successfully", typeof(Asset))]
        [SwaggerOperation(
            Summary = "Create an Asset",
            OperationId = nameof(PostAsset),
            Tags = new[] { "Asset" }
        )]
        [SuppressMessage("Design", "CA1062:Validate arguments of public methods", Justification = "Checked by `Required` attribute")]
        public async Task<IActionResult> PostAsset(
            [SwaggerParameter("The Asset", Required = true), FromBody, Required] Asset model,
            CancellationToken cancellationToken)
        {
            if (model.Id != default)
            {
                ModelState.AddModelError(nameof(model), "Id must be empty");
                return BadRequest(ModelState);
            }

            var request = new CreateRequest<Asset>(nameof(MongoDB), model, _logger);
            await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
            return Created(model);
        }

        [ODataRoute("({id})", RouteName = nameof(PatchAsset))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status204NoContent, "Asset updated successfully")]
        [SwaggerOperation(
            Summary = "Update an Asset",
            OperationId = nameof(PatchAsset),
            Tags = new[] { "Asset" }
        )]
        [SuppressMessage("Design", "CA1062:Validate arguments of public methods", Justification = "Checked by `Required` attribute")]
        public async Task<IActionResult> PatchAsset(
            [SwaggerParameter("The Asset Id", Required = true), FromODataUri, NotDefault] Guid id,
            [SwaggerParameter("The Asset", Required = true), Required] Delta<Asset> delta,
            CancellationToken cancellationToken)
        {
            var getRequest = new GetRequest<Asset>(nameof(MongoDB), new object[] { id }, _logger);
            var model = await _mediator.Send(getRequest, cancellationToken).ConfigureAwait(false);
            delta.Patch(model);
            model.UpdatedDate = UtcNow;
            var updateRequest = new UpdateRequest<Asset>(nameof(MongoDB), x => x.Id == id, model, _logger);
            await _mediator.Send(updateRequest, cancellationToken).ConfigureAwait(false);
            return NoContent();
        }

        [ODataRoute("({id})", RouteName = nameof(PutAsset))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status204NoContent, "Asset replaced successfully")]
        [SwaggerOperation(
            Summary = "Replace an Asset",
            OperationId = nameof(PutAsset),
            Tags = new[] { "Asset" }
        )]
        [SuppressMessage("Design", "CA1062:Validate arguments of public methods", Justification = "Checked by `Required` attribute")]
        public async Task<IActionResult> PutAsset(
            [SwaggerParameter("The Asset Id", Required = true), FromODataUri, NotDefault] Guid id,
            [SwaggerParameter("The Asset", Required = true), Required] Delta<Asset> delta,
            CancellationToken cancellationToken)
        {
            var model = delta.GetInstance();
            if (model.Id != id)
            {
                ModelState.AddModelError(nameof(id), "Ids must match");
                return BadRequest(ModelState);
            }

            model.UpdatedDate = UtcNow;
            var request = new UpdateRequest<Asset>(nameof(MongoDB), x => x.Id == id, model, _logger);
            await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
            return NoContent();
        }

        [ODataRoute("({id})", RouteName = nameof(DeleteAsset))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status204NoContent, "Asset deleted successfully")]
        [SwaggerOperation(
            Summary = "Delete an Asset",
            OperationId = nameof(DeleteAsset),
            Tags = new[] { "Asset" }
        )]
        public async Task<IActionResult> DeleteAsset(
            [SwaggerParameter("The Asset Id", Required = true), FromODataUri, NotDefault] Guid id,
            CancellationToken cancellationToken)
        {
            var request = new DeleteRequest<Asset>(nameof(MongoDB), x => x.Id == id, _logger);
            await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
            return NoContent();
        }
    }
}
