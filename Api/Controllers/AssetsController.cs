namespace Assets.Controllers
{
    using System;
    using System.Collections.Generic;
    using System.ComponentModel.DataAnnotations;
    using System.Linq;
    using System.Linq.Expressions;
    using System.Text.Json;
    using System.Threading;
    using System.Threading.Tasks;
    using Common;
    using MediatR;
    using Microsoft.AspNet.OData;
    using Microsoft.AspNet.OData.Query;
    using Microsoft.AspNet.OData.Routing;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.Extensions.Logging;
    using Microsoft.OData;
    using Requests;
    using Swashbuckle.AspNetCore.Annotations;
    using static System.DateTime;
    using static System.Net.Mime.MediaTypeNames.Application;
    using static System.String;
    using static Asset;
    using static Common.EventIds;
    using static Microsoft.AspNetCore.Http.StatusCodes;

    [ODataRoutePrefix("Assets")]
    [Produces(Json)]
    public class AssetsController : ODataController
    {
        private readonly ILogger<AssetsController> _logger;
        private readonly IDataCommandService _dataCommandService;
        private readonly IMediator _mediator;

        public AssetsController(
            IMediator mediator,
            ILogger<AssetsController> logger,
            IEnumerable<IDataCommandService> dataCommandServices)
        {
            _mediator = mediator;
            _logger = logger;
            _dataCommandService = dataCommandServices.Single(x => x.Name == nameof(MongoDB));
        }

        [ODataRoute(RouteName = nameof(GetAssets))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status200OK, "Get Assets", typeof(ODataValue<List<Asset>>))]
        public async Task<IActionResult> GetAssets(ODataQueryOptions<Asset> options, CancellationToken cancellationToken)
        {
            //IActionResult result;
            //try
            //{
                var request = new GetAssetsRequest(nameof(MongoDB), options);
                var response = await _mediator.Send(request, cancellationToken).ConfigureAwait(false);
                return Ok(response);
            //}
            //catch (ODataException e)
            //{
            //    result = BadRequest(e.Message);
            //}
            //catch (ArgumentException e) when (!IsNullOrWhiteSpace(e.ParamName))
            //{
            //    ModelState.AddModelError(e.ParamName, e.Message);
            //    result = BadRequest(ModelState);
            //}
            //catch (ArgumentException e)
            //{
            //    result = BadRequest(e.Message);
            //}
            //catch (Exception e)
            //{
            //    _logger.LogError(GetRange, e, e.Message);
            //    throw;
            //}

            //_logger.LogInformation(GetRange, "", result);
            //return result;
        }

        [ODataRoute(RouteName = nameof(PostAssets))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status200OK, "Create Assets", typeof(ODataValue<List<Asset>>))]
        public async Task<IActionResult> PostAssets([FromBody, Required] JsonElement element, CancellationToken cancellationToken)
        {
            IActionResult result;
            if (element.ValueKind != JsonValueKind.Array)
            {
                ModelState.AddModelError(nameof(element), "Models must be an array");
                result = BadRequest(ModelState);
            }
            else if (element.GetArrayLength() == 0)
            {
                ModelState.AddModelError(nameof(element), "Models cannot be empty");
                result = BadRequest(ModelState);
            }
            else
            {
                try
                {
                    var models = element.EnumerateArray().Select(FromJsonElement).ToArray();
                    if (models.Any(x => x.Id != default))
                    {
                        ModelState.AddModelError(nameof(element), "Ids must be empty");
                        result = BadRequest(ModelState);
                    }
                    else
                    {
                        var response = await _dataCommandService.CreateRangeAsync(models, cancellationToken).ConfigureAwait(false);
                        await _dataCommandService.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                        result = Ok(response.ToList());
                    }
                }
                catch (ArgumentException e) when (!IsNullOrWhiteSpace(e.ParamName))
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
        public async Task<IActionResult> PutAssets([FromBody] JsonElement element, CancellationToken cancellationToken)
        {
            IActionResult result;
            if (element.ValueKind != JsonValueKind.Array)
            {
                ModelState.AddModelError(nameof(element), "Models must be an array");
                result = BadRequest(ModelState);
            }
            else if (element.GetArrayLength() == 0)
            {
                ModelState.AddModelError(nameof(element), "Models cannot be empty");
                result = BadRequest(ModelState);
            }
            else
            {
                try
                {
                    var models = element.EnumerateArray().Select(FromJsonElement).ToList();
                    models.ForEach(model => model.UpdatedDate = UtcNow);
                    var keyValuePairs = models.ToDictionary<Asset, Expression<Func<Asset, bool>>, Asset>(x => y => y.Id == x.Id, x => x);
                    await _dataCommandService.UpdateRangeAsync(keyValuePairs, cancellationToken).ConfigureAwait(false);
                    await _dataCommandService.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                    result = NoContent();
                }
                catch (ArgumentException e) when (!IsNullOrWhiteSpace(e.ParamName))
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
                catch (ArgumentException e) when (!IsNullOrWhiteSpace(e.ParamName))
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
