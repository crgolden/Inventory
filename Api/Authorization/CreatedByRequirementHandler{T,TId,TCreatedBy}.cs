namespace Inventory.Authorization
{
    using System;
    using System.Collections.Generic;
    using System.IO;
    using System.Linq;
    using System.Security.Claims;
    using System.Text.Json;
    using System.Text.Json.Serialization;
    using System.Threading.Tasks;
    using Common;
    using Core.Requests;
    using Extensions;
    using MediatR;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.AspNetCore.Routing;
    using Microsoft.Extensions.Caching.Memory;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;
    using StackExchange.Redis;
    using static System.ComponentModel.TypeDescriptor;
    using static System.String;
    using static System.StringComparison;
    using static System.Text.Json.JsonSerializer;
    using static System.Threading.Tasks.Task;
    using static Microsoft.AspNetCore.Http.HttpMethods;
    using static Microsoft.IdentityModel.JsonWebTokens.JwtRegisteredClaimNames;
    using static StackExchange.Redis.CommandFlags;

    public class CreatedByRequirementHandler<T, TId, TCreatedBy> : AuthorizationHandler<CreatedByRequirement<T, TId, TCreatedBy>>
        where T : class, IKeyable<TId>, ICreatable<TCreatedBy>, new()
        where TId : notnull
        where TCreatedBy : IComparable<TCreatedBy>, IEquatable<TCreatedBy>
    {
        private readonly IMediator _mediator;
        private readonly ILogger<AuthorizationHandler<CreatedByRequirement<T, TId, TCreatedBy>>> _logger;
        private readonly IDatabase _database;
        private readonly IMemoryCache _cache;
        private readonly MemoryCacheEntryOptions _memoryCacheEntryOptions;
        private readonly JsonSerializerOptions _jsonSerializerOptions;

        public CreatedByRequirementHandler(
            IMediator mediator,
            ILogger<AuthorizationHandler<CreatedByRequirement<T, TId, TCreatedBy>>> logger,
            IConnectionMultiplexer redis,
            IMemoryCache cache,
            IOptions<MemoryCacheEntryOptions> memoryCacheEntryOptions,
            JsonConverter<T> jsonConverter)
        {
            _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            if (redis == default)
            {
                throw new ArgumentNullException(nameof(redis));
            }

            _database = redis.GetDatabase();
            _cache = cache ?? throw new ArgumentNullException(nameof(cache));
            _memoryCacheEntryOptions = memoryCacheEntryOptions?.Value ?? throw new ArgumentNullException(nameof(memoryCacheEntryOptions));
            if (jsonConverter == default)
            {
                throw new ArgumentNullException(nameof(jsonConverter));
            }

            _jsonSerializerOptions = new JsonSerializerOptions();
            _jsonSerializerOptions.Converters.Add(jsonConverter);
        }

        protected override Task HandleRequirementAsync(
            AuthorizationHandlerContext context,
            CreatedByRequirement<T, TId, TCreatedBy> requirement)
        {
            if (context == default)
            {
                throw new ArgumentNullException(nameof(context));
            }

            if (requirement == default)
            {
                throw new ArgumentNullException(nameof(requirement));
            }

            if (context.User.Identity?.IsAuthenticated != true)
            {
                return CompletedTask;
            }

            if (requirement.AllowedRoles.Any(role => context.User.IsInRole(role)))
            {
                context.Succeed(requirement);
                return CompletedTask;
            }

            if (!(context.Resource is ActionContext actionContext))
            {
                return CompletedTask;
            }

            if (actionContext.RouteData.Values.ContainsKey("id"))
            {
                return HandleByIdAsync(context, actionContext.RouteData.Values, requirement).AsTask();
            }

            if (IsPut(actionContext.HttpContext.Request.Method))
            {
                return HandlePutAsync(context, actionContext.HttpContext.Request, requirement).AsTask();
            }

            if (IsDelete(actionContext.HttpContext.Request.Method))
            {
                return HandleDeleteAsync(context, actionContext.HttpContext.Request.Query, requirement).AsTask();
            }

            return CompletedTask;
        }

        private async ValueTask HandlePutAsync(
            AuthorizationHandlerContext context,
            HttpRequest request,
            CreatedByRequirement<T, TId, TCreatedBy> requirement)
        {
            ICollection<T> models;
            request.EnableBuffering();
            using (var reader = new StreamReader(request.Body, leaveOpen: true))
            {
                var body = await reader.ReadToEndAsync().ConfigureAwait(false);
                models = Deserialize<ICollection<T>>(body, _jsonSerializerOptions);
                request.Body.Position = 0;
            }

            var keyValuePairs = models.ToDictionary(model => model.Key, model => default(T?));
            await HandleKeyValuePairsAsync(context, keyValuePairs, requirement).ConfigureAwait(false);
        }

        private async ValueTask HandleDeleteAsync(
            AuthorizationHandlerContext context,
            IQueryCollection query,
            CreatedByRequirement<T, TId, TCreatedBy> requirement)
        {
            var ids = query.Where(x => x.Key.StartsWith("ids[", InvariantCultureIgnoreCase) &&
                                       x.Key.EndsWith("]", InvariantCultureIgnoreCase));
            var converter = GetConverter(typeof(TId));
            var keyValuePairs = ids.Select(id => (TId)converter.ConvertFromString(id.Value)).ToDictionary(id => id, id => default(T?));
            await HandleKeyValuePairsAsync(context, keyValuePairs, requirement).ConfigureAwait(false);
        }

        private async ValueTask HandleByIdAsync(
            AuthorizationHandlerContext context,
            RouteValueDictionary routeValues,
            CreatedByRequirement<T, TId, TCreatedBy> requirement)
        {
            var key = (TId)routeValues["id"];
            if (!_cache.TryGetValue(key, out T value))
            {
                var redisValue = await _database.StringGetAsync(key.ToString()).ConfigureAwait(false);
                if (redisValue.IsNullOrEmpty)
                {
                    var request = new GetRequest<T>(requirement.Name, new object[] { key }, _logger);
                    value = await _mediator.Send(request).ConfigureAwait(false);
                    if (value != default)
                    {
                        await _database.StringSetAsync(key.ToString(), Serialize(value), flags: FireAndForget).ConfigureAwait(false);
                    }
                }
                else
                {
                    value = Deserialize<T>(redisValue, _jsonSerializerOptions);
                }

                if (value != default)
                {
                    _cache.SetCacheEntry(key, value, _memoryCacheEntryOptions);
                }
            }

            var userId = context.User.FindFirstValue(Sub);
            if (value == default || string.Equals(value.CreatedBy.ToString(), userId, InvariantCultureIgnoreCase))
            {
                context.Succeed(requirement);
            }
        }

        private async ValueTask HandleKeyValuePairsAsync(
            AuthorizationHandlerContext context,
            IDictionary<TId, T?> keyValuePairs,
            CreatedByRequirement<T, TId, TCreatedBy> requirement)
        {
            var userId = context.User.FindFirstValue(Sub);
            var allowed = await GetCachedModels(keyValuePairs, userId).ConfigureAwait(false);
            if (!allowed)
            {
                return;
            }

            allowed = await GetNonCachedModels(keyValuePairs, userId, requirement.Name).ConfigureAwait(false);
            if (!allowed)
            {
                return;
            }

            context.Succeed(requirement);
        }

        private async ValueTask<bool> GetCachedModels(IDictionary<TId, T?> keyValuePairs, string userId)
        {
            var keys = new List<TId>(keyValuePairs.Count);
            var cached = new Dictionary<TId, T>(keyValuePairs.Count);
            foreach (var key in keyValuePairs.Keys)
            {
                if (_cache.TryGetValue(key, out T value))
                {
                    cached.Add(key, value);
                }
                else
                {
                    keys.Add(key);
                }
            }

            foreach (var (key, value) in cached)
            {
                keyValuePairs[key] = value;
            }

            if (keys.Any())
            {
                var values = await _database.StringGetAsync(keys.Select<TId, RedisKey>(x => x.ToString()).ToArray()).ConfigureAwait(false);
                foreach (var value in values.Where(x => !x.IsNullOrEmpty).Select(x => Deserialize<T>(x, _jsonSerializerOptions)))
                {
                    cached.Add(value.Key, value);
                }
            }

            var allowed = true;
            foreach (var value in cached.Values)
            {
                allowed = SetKey(keyValuePairs, value, userId);
            }

            return allowed;
        }

        private async ValueTask<bool> GetNonCachedModels(IDictionary<TId, T?> keyValuePairs, string userId, string name)
        {
            if (keyValuePairs.All(x => x.Value != default))
            {
                return true;
            }

            var queryRequest = new QueryRequest<T>(name);
            var query = await _mediator.Send(queryRequest).ConfigureAwait(false);
            var keys = keyValuePairs.Where(x => x.Value == default).Select(x => x.Key).ToArray();
            query = query.Where(x => keys.Contains(x.Key));
            var getRangeRequest = new GetRangeRequest<T>(name, query, _logger);
            var models = await _mediator.Send(getRangeRequest).ConfigureAwait(false);
            var values = new List<KeyValuePair<RedisKey, RedisValue>>(models.Count);
            var allowed = true;
            foreach (var model in models.Where(x => x.Key != null))
            {
                allowed = SetKey(keyValuePairs, model, userId);
                values.Add(new KeyValuePair<RedisKey, RedisValue>(model.Key.ToString(), Serialize(model)));
            }

            if (values.Any(x => !IsNullOrWhiteSpace(x.Key)))
            {
                await _database.StringSetAsync(values.Where(x => !IsNullOrWhiteSpace(x.Key)).ToArray(), flags: FireAndForget).ConfigureAwait(false);
            }

            return allowed;
        }

        private bool SetKey(IDictionary<TId, T?> keyValuePairs, T model, string userId)
        {
            if (model.Key == null)
            {
                return true;
            }

            _cache.SetCacheEntry(model.Key, model, _memoryCacheEntryOptions);
            if (!string.Equals(model.CreatedBy.ToString(), userId, InvariantCultureIgnoreCase))
            {
                return false;
            }

            keyValuePairs[model.Key] = model;
            return true;
        }
    }
}
