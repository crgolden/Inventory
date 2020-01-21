namespace Assets.Controllers
{
    using System;
    using System.Collections.Generic;
    using System.ComponentModel.DataAnnotations;
    using System.Linq;
    using System.Threading;
    using System.Threading.Tasks;
    using Common;
    using Microsoft.AspNet.OData;
    using Microsoft.AspNet.OData.Routing;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.Extensions.Logging;
    using Swashbuckle.AspNetCore.Annotations;
    using static System.String;
    using static Microsoft.AspNetCore.Http.StatusCodes;

    [ODataRoutePrefix("Asset")]
    public class AssetController : ODataController
    {
        private readonly ILogger<AssetController> _logger;
        private readonly IDataQueryService _dataQueryService;
        private readonly IDataCommandService _dataCommandService;

        public AssetController(
            ILogger<AssetController> logger,
            IEnumerable<IDataQueryService> dataQueryServices,
            IEnumerable<IDataCommandService> dataCommandServices)
        {
            _logger = logger;
            _dataQueryService = dataQueryServices.Single(x => x.Name == nameof(MongoDB));
            _dataCommandService = dataCommandServices.Single(x => x.Name == nameof(MongoDB));
        }

        [ODataRoute("{id}", RouteName = nameof(GetAsset))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status200OK, "Get an Asset", typeof(Asset))]
        public async Task<IActionResult> GetAsset([FromODataUri] Guid id, CancellationToken cancellationToken)
        {
            IActionResult result;
            if (id == default)
            {
                ModelState.AddModelError(nameof(id), "Id is required");
                result = BadRequest(ModelState);
            }
            else
            {
                try
                {
                    var query = _dataQueryService.Query<Asset>();
                    var model = await _dataQueryService.GetAsync(query, new object[] { id }, cancellationToken).ConfigureAwait(false);
                    result = Ok(model);
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

        [ODataRoute(RouteName = nameof(PostAsset))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status201Created, "Create an Asset", typeof(Asset))]
        public async Task<IActionResult> PostAsset([FromBody, Required] Asset model, CancellationToken cancellationToken)
        {
            IActionResult result;
            if (model == default)
            {
                ModelState.AddModelError(nameof(model), "Model is required");
                result = BadRequest(ModelState);
            }
            else if (model.Id != default)
            {
                ModelState.AddModelError(nameof(model), "Id must be empty");
                result = BadRequest(ModelState);
            }
            else
            {
                try
                {
                    model = await _dataCommandService.CreateAsync(model, cancellationToken).ConfigureAwait(false);
                    await _dataCommandService.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                    var routeValues = new
                    {
                        odataPath = $"Asset/{model.Id}",
                        model.Id
                    };
                    result = CreatedAtAction(nameof(GetAsset), routeValues, model);
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

        [ODataRoute("{id}", RouteName = nameof(PutAsset))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status204NoContent, "Update an Asset")]
        public async Task<IActionResult> PutAsset(
            [FromODataUri] Guid id,
            [FromBody, Required] Asset model,
            CancellationToken cancellationToken)
        {
            IActionResult result;
            if (id == default)
            {
                ModelState.AddModelError(nameof(id), "Id is required");
                result = BadRequest(ModelState);
            }
            else if (id != model?.Id)
            {
                ModelState.AddModelError(nameof(id), "Ids must match");
                result = BadRequest(ModelState);
            }
            else
            {
                try
                {
                    await _dataCommandService.UpdateAsync(x => x.Id == id, model, cancellationToken).ConfigureAwait(false);
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

        [ODataRoute("{id}", RouteName = nameof(DeleteAsset))]
        [MapToApiVersion("1.0")]
        [SwaggerResponse(Status204NoContent, "Delete an Asset")]
        public async Task<IActionResult> DeleteAsset([FromODataUri] Guid id, CancellationToken cancellationToken)
        {
            IActionResult result;
            if (id == default)
            {
                ModelState.AddModelError(nameof(id), "Id is required");
                result = BadRequest(ModelState);
            }
            else
            {
                try
                {
                    await _dataCommandService.DeleteAsync<Asset>(x => x.Id == id, cancellationToken).ConfigureAwait(false);
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
