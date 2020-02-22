namespace Inventory.Controllers
{
    using System;
    using System.Collections.Generic;
    using System.ComponentModel.DataAnnotations;
    using System.Diagnostics.CodeAnalysis;
    using System.Linq;
    using System.Linq.Expressions;
    using System.Security.Claims;
    using System.Text.Json;
    using System.Threading;
    using System.Threading.Tasks;
    using Core.Requests;
    using MediatR;
    using Microsoft.AspNet.OData;
    using Microsoft.AspNet.OData.Query;
    using Microsoft.AspNet.OData.Routing;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.Extensions.Logging;
    using Microsoft.OData;
    using Notifications;
    using Swashbuckle.AspNetCore.Annotations;
    using static System.DateTime;
    using static System.Net.Mime.MediaTypeNames.Application;
    using static Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults;
    using static Microsoft.AspNetCore.Http.StatusCodes;
    using static Microsoft.IdentityModel.JsonWebTokens.JwtRegisteredClaimNames;

    [Produces(Json)]
    [Consumes(Json)]
    [ODataRoutePrefix("Assets")]
    [Authorize(AuthenticationSchemes = AuthenticationScheme, Roles = "User")]
    [SwaggerTag("Create, Read, Update, and Delete Assets")]
    public class AssetsController : ODataController
    {
        private readonly IMediator _mediator;
        private readonly ILogger<AssetsController> _logger;

        public AssetsController(IMediator mediator, ILogger<AssetsController> logger)
        {
            _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
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
            var queryRequest = new QueryRequest<Asset>(nameof(MongoDB));
            var query = await _mediator.Send(queryRequest, cancellationToken).ConfigureAwait(false);
            try
            {
                query = (IQueryable<Asset>)options.ApplyTo(query);
            }
            catch (ODataException e)
            {
                ModelState.AddModelError(nameof(options), e.Message);
                return BadRequest(ModelState);
            }

            if (!User.IsInRole("Admin"))
            {
                query = query.Where(x => x.CreatedBy == Guid.Parse(User.FindFirstValue(Sub)));
            }

            var getRangeRequest = new GetRangeRequest<Asset>(nameof(MongoDB), query, _logger);
            var response = await _mediator.Send(getRangeRequest, cancellationToken).ConfigureAwait(false);
            var notification = new GetRangeNotification<Asset>(response.ToDictionary<Asset, object>(x => x.Id));
            await _mediator.Publish(notification, cancellationToken).ConfigureAwait(false);
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

            var models = element.EnumerateArray().Select(x => x.ToModel<Asset>()).ToList();
            if (models.Any(x => x.Id != default))
            {
                ModelState.AddModelError(nameof(element), "Ids must be empty");
                return BadRequest(ModelState);
            }

            var userId = Guid.Parse(User.FindFirstValue(Sub));
            models.ForEach(model => model.CreatedBy = userId);
            var request = new CreateRangeRequest<Asset>(nameof(MongoDB), models, _logger);
            await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
            var notification = new CreateRangeNotification<Asset>(models.ToDictionary<Asset, object>(x => x.Id));
            await _mediator.Publish(notification, cancellationToken).ConfigureAwait(false);
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
        [Authorize(Policy = nameof(PutAssets))]
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

            var models = element.EnumerateArray().Select(x => x.ToModel<Asset>()).ToList();
            var userId = Guid.Parse(User.FindFirstValue(Sub));
            models.ForEach(model =>
            {
                model.UpdatedBy = userId;
                model.UpdatedDate = UtcNow;
            });
            var keyValuePairs = models.ToDictionary(model => (Expression<Func<Asset, bool>>)(x => x.Id == model.Id));
            var updateRequest = new UpdateRangeRequest<Asset>(nameof(MongoDB), keyValuePairs, _logger);
            await _mediator.Send(updateRequest, cancellationToken).ConfigureAwait(false);
            var notification = new UpdateRangeNotification<Asset>(models.ToDictionary<Asset, object>(x => x.Id));
            await _mediator.Publish(notification, cancellationToken).ConfigureAwait(false);
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
        [Authorize(Policy = nameof(DeleteAssets))]
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
            var notification = new DeleteRangeNotification(ids.Cast<object>().ToArray());
            await _mediator.Publish(notification, cancellationToken).ConfigureAwait(false);
            return NoContent();
        }
    }
}
