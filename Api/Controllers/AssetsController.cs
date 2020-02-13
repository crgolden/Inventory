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
    using StackExchange.Redis;
    using Swashbuckle.AspNetCore.Annotations;
    using static System.DateTime;
    using static System.Text.Json.JsonSerializer;
    using static Asset;
    using static Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults;
    using static Microsoft.AspNetCore.Http.StatusCodes;
    using static Microsoft.IdentityModel.JsonWebTokens.JwtRegisteredClaimNames;

    [ODataRoutePrefix("Assets")]
    [Authorize(AuthenticationSchemes = AuthenticationScheme, Roles = "User")]
    [SwaggerTag("Create, Read, Update, and Delete Assets")]
    public class AssetsController : ODataController
    {
        private readonly IMediator _mediator;
        private readonly ILogger<AssetsController> _logger;
        private readonly IDatabase _database;

        public AssetsController(
            IMediator mediator,
            ILogger<AssetsController> logger,
            IConnectionMultiplexer redis)
        {
            _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            if (redis == default)
            {
                throw new ArgumentNullException(nameof(redis));
            }

            _database = redis.GetDatabase();
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

            var getRangeRequest = new GetRangeRequest<Asset>(nameof(MongoDB), query, _logger);
            var response = await _mediator.Send(getRangeRequest, cancellationToken).ConfigureAwait(false);
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

            var userId = Guid.Parse(User.FindFirstValue(Sub));
            models.ForEach(model => model.CreatedBy = userId);
            var request = new CreateRangeRequest<Asset>(nameof(MongoDB), models, _logger);
            await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
            await SetCachedModels(models).ConfigureAwait(false);
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
            var userId = Guid.Parse(User.FindFirstValue(Sub));
            var dictionary = models.ToDictionary<Asset, RedisKey, Asset?>(model => model.Id.ToString(), _ => default);
            var allowed = await GetCachedModels(dictionary, userId).ConfigureAwait(false);
            if (!allowed)
            {
                return Forbid(AuthenticationScheme);
            }

            allowed = await GetNonCachedModels(dictionary, userId, cancellationToken).ConfigureAwait(false);
            if (!allowed)
            {
                return Forbid(AuthenticationScheme);
            }

            if (dictionary.Any(x => x.Value == default))
            {
                var keys = dictionary.Where(x => x.Value == default).Select(x => Guid.Parse(x.Key));
                models.RemoveAll(model => keys.Contains(model.Id));
            }

            models.ForEach(model =>
            {
                model.UpdatedBy = userId;
                model.UpdatedDate = UtcNow;
            });
            var keyValuePairs = models.ToDictionary(model => (Expression<Func<Asset, bool>>)(x => x.Id == model.Id), model => model);
            var updateRequest = new UpdateRangeRequest<Asset>(nameof(MongoDB), keyValuePairs, _logger);
            await _mediator.Send(updateRequest, cancellationToken).ConfigureAwait(false);
            await SetCachedModels(models).ConfigureAwait(false);
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

            var userId = Guid.Parse(User.FindFirstValue(Sub));
            var dictionary = ids.ToDictionary<Guid, RedisKey, Asset?>(id => id.ToString(), _ => default);
            var allowed = await GetCachedModels(dictionary, userId).ConfigureAwait(false);
            if (!allowed)
            {
                return Forbid(AuthenticationScheme);
            }

            allowed = await GetNonCachedModels(dictionary, userId, cancellationToken).ConfigureAwait(false);
            if (!allowed)
            {
                return Forbid(AuthenticationScheme);
            }

            if (dictionary.Any(x => x.Value == default))
            {
                var keys = dictionary.Where(x => x.Value == default).Select(x => Guid.Parse(x.Key));
                ids = ids.Where(id => !keys.Contains(id)).ToArray();
            }

            var expressions = ids.Select(id => (Expression<Func<Asset, bool>>)(asset => asset.Id == id));
            var request = new DeleteRangeRequest<Asset>(nameof(MongoDB), expressions.ToArray(), _logger);
            await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
            await _database.KeyDeleteAsync(ids.Select<Guid, RedisKey>(x => x.ToString()).ToArray()).ConfigureAwait(false);
            return NoContent();
        }

        private async Task<bool> GetCachedModels(Dictionary<RedisKey, Asset?> dictionary, Guid userId)
        {
            var values = await _database.StringGetAsync(dictionary.Keys.ToArray()).ConfigureAwait(false);
            foreach (var model in values.Select(value => Deserialize<Asset>(value)))
            {
                if (model.CreatedBy != userId)
                {
                    return false;
                }

                dictionary[model.Id.ToString()] = model;
            }

            return true;
        }

        private Task<bool> SetCachedModels(IEnumerable<Asset> models)
        {
            var values = models.Select(model => new KeyValuePair<RedisKey, RedisValue>(model.Id.ToString(), Serialize(model)));
            return _database.StringSetAsync(values.ToArray());
        }

        private async ValueTask<bool> GetNonCachedModels(IDictionary<RedisKey, Asset?> dictionary, Guid userId, CancellationToken cancellationToken)
        {
            if (dictionary.All(x => x.Value != default))
            {
                return true;
            }

            var queryRequest = new QueryRequest<Asset>(nameof(MongoDB));
            var query = await _mediator.Send(queryRequest, cancellationToken).ConfigureAwait(false);
            var keys = dictionary.Where(x => x.Value == default).Select(x => Guid.Parse(x.Key)).ToArray();
            query = query.Where(x => keys.Contains(x.Id));
            var getRequest = new GetRangeRequest<Asset>(nameof(MongoDB), query, _logger);
            var models = await _mediator.Send(getRequest, cancellationToken).ConfigureAwait(false);
            foreach (var model in models)
            {
                if (model.CreatedBy != userId)
                {
                    return false;
                }

                dictionary[model.Id.ToString()] = model;
            }

            return true;
        }
    }
}
