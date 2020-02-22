namespace Inventory.Controllers
{
    using System;
    using System.ComponentModel.DataAnnotations;
    using System.Diagnostics.CodeAnalysis;
    using System.Security.Claims;
    using System.Threading;
    using System.Threading.Tasks;
    using Common;
    using Core.Requests;
    using MediatR;
    using Microsoft.AspNet.OData;
    using Microsoft.AspNet.OData.Routing;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.Extensions.Caching.Memory;
    using Microsoft.Extensions.Logging;
    using Notifications;
    using Swashbuckle.AspNetCore.Annotations;
    using static System.DateTime;
    using static Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults;
    using static Microsoft.AspNetCore.Http.StatusCodes;
    using static Microsoft.IdentityModel.JsonWebTokens.JwtRegisteredClaimNames;

    [ODataRoutePrefix("Asset")]
    [Authorize(AuthenticationSchemes = AuthenticationScheme, Roles = "User")]
    [SwaggerTag("Create, Read, Update, and Delete Assets")]
    public class AssetController : ODataController
    {
        private readonly IMediator _mediator;
        private readonly ILogger<AssetController> _logger;
        private readonly IMemoryCache _cache;

        public AssetController(
            IMediator mediator,
            ILogger<AssetController> logger,
            IMemoryCache cache)
        {
            _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        }

        [ODataRoute("({id})", RouteName = nameof(GetAsset))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status200OK, "Asset retrieved successfully", typeof(Asset))]
        [SwaggerOperation(
            Summary = "Get an Asset",
            OperationId = nameof(GetAsset),
            Tags = new[] { "Asset" }
        )]
        [Authorize(Policy = nameof(GetAsset))]
        public async Task<IActionResult> GetAsset(
            [SwaggerParameter("The Asset Id", Required = true), FromODataUri, NotDefault] Guid id,
            CancellationToken cancellationToken)
        {
            IActionResult result;
            if (_cache.TryGetValue(id, out _))
            {
                var request = new Requests.GetRequest<Asset>(nameof(MongoDB), id, _logger);
                var model = await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
                result = Ok(model);
            }
            else
            {
                result = NotFound();
            }

            return result;
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
            IActionResult result;
            if (model.Id != default)
            {
                ModelState.AddModelError(nameof(model), "Id must be empty");
                result = BadRequest(ModelState);
            }
            else
            {
                model.CreatedBy = Guid.Parse(User.FindFirstValue(Sub));
                var request = new CreateRequest<Asset>(nameof(MongoDB), model, _logger);
                await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
                var notification = new CreateNotification<Asset>(model.Id, model);
                await _mediator.Publish(notification, cancellationToken).ConfigureAwait(false);
                result = Created(model);
            }

            return result;
        }

        [ODataRoute("({id})", RouteName = nameof(PatchAsset))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status204NoContent, "Asset updated successfully")]
        [SwaggerOperation(
            Summary = "Update an Asset",
            OperationId = nameof(PatchAsset),
            Tags = new[] { "Asset" }
        )]
        [Authorize(Policy = nameof(PatchAsset))]
        [SuppressMessage("Design", "CA1062:Validate arguments of public methods", Justification = "Checked by `Required` attribute")]
        public async Task<IActionResult> PatchAsset(
            [SwaggerParameter("The Asset Id", Required = true), FromODataUri, NotDefault] Guid id,
            [SwaggerParameter("The Asset", Required = true), Required] Delta<Asset> delta,
            CancellationToken cancellationToken)
        {
            IActionResult result;
            if (_cache.TryGetValue(id, out _))
            {
                var getRequest = new Requests.GetRequest<Asset>(nameof(MongoDB), id.ToString(), _logger);
                var model = await _mediator.Send(getRequest, cancellationToken).ConfigureAwait(false);
                delta.Patch(model);
                model.UpdatedBy = Guid.Parse(User.FindFirstValue(Sub));
                model.UpdatedDate = UtcNow;
                var updateRequest = new UpdateRequest<Asset>(nameof(MongoDB), x => x.Id == id, model, _logger);
                await _mediator.Send(updateRequest, cancellationToken).ConfigureAwait(false);
                var notification = new UpdateNotification<Asset>(id, model);
                await _mediator.Publish(notification, cancellationToken).ConfigureAwait(false);
                result = NoContent();
            }
            else
            {
                result = NotFound();
            }

            return result;
        }

        [ODataRoute("({id})", RouteName = nameof(PutAsset))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status204NoContent, "Asset replaced successfully")]
        [SwaggerOperation(
            Summary = "Replace an Asset",
            OperationId = nameof(PutAsset),
            Tags = new[] { "Asset" }
        )]
        [Authorize(Policy = nameof(PutAsset))]
        [SuppressMessage("Design", "CA1062:Validate arguments of public methods", Justification = "Checked by `Required` attribute")]
        public async Task<IActionResult> PutAsset(
            [SwaggerParameter("The Asset Id", Required = true), FromODataUri, NotDefault] Guid id,
            [SwaggerParameter("The Asset", Required = true), Required] Delta<Asset> delta,
            CancellationToken cancellationToken)
        {
            IActionResult result;
            if (delta.GetInstance().Id != id)
            {
                ModelState.AddModelError(nameof(id), "Ids must match");
                result = BadRequest(ModelState);
            }
            else if (_cache.TryGetValue(id, out _))
            {
                var getRequest = new Requests.GetRequest<Asset>(nameof(MongoDB), id, _logger);
                var model = await _mediator.Send(getRequest, cancellationToken).ConfigureAwait(false);
                delta.Put(model);
                model.UpdatedBy = Guid.Parse(User.FindFirstValue(Sub));
                model.UpdatedDate = UtcNow;
                var updateRequest = new UpdateRequest<Asset>(nameof(MongoDB), x => x.Id == id, model, _logger);
                await _mediator.Send(updateRequest, cancellationToken).ConfigureAwait(false);
                var notification = new UpdateNotification<Asset>(id, model);
                await _mediator.Publish(notification, cancellationToken).ConfigureAwait(false);
                result = NoContent();
            }
            else
            {
                result = NotFound();
            }

            return result;
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
            IActionResult result;
            if (_cache.TryGetValue(id, out _))
            {
                var request = new DeleteRequest<Asset>(nameof(MongoDB), x => x.Id == id, _logger);
                await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
                var notification = new DeleteNotification(id);
                await _mediator.Publish(notification, cancellationToken).ConfigureAwait(false);
                result = NoContent();
            }
            else
            {
                result = NotFound();
            }

            return result;
        }
    }
}
