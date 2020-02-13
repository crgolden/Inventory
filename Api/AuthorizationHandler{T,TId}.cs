namespace Inventory
{
    using System;
    using System.Linq;
    using System.Security.Claims;
    using System.Threading.Tasks;
    using Common;
    using Controllers;
    using Core.Requests;
    using MediatR;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc.Filters;
    using Microsoft.Extensions.Caching.Memory;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;
    using StackExchange.Redis;
    using static System.Text.Json.JsonSerializer;
    using static System.Threading.Tasks.Task;
    using static Microsoft.IdentityModel.JsonWebTokens.JwtRegisteredClaimNames;

    public class AuthorizationHandler<T, TId> : IAuthorizationHandler
        where T : class, ICreatable<TId>
        where TId : IComparable<TId>, IEquatable<TId>
    {
        private readonly IMediator _mediator;
        private readonly ILogger<AssetController> _logger;
        private readonly IDatabase _database;
        private readonly IMemoryCache _cache;
        private readonly MemoryCacheEntryOptions _options;

        public AuthorizationHandler(
            IMediator mediator,
            ILogger<AssetController> logger,
            IConnectionMultiplexer redis,
            IMemoryCache cache,
            IOptions<MemoryCacheEntryOptions> options)
        {
            _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            if (redis == default)
            {
                throw new ArgumentNullException(nameof(redis));
            }

            _database = redis.GetDatabase();
            _cache = cache ?? throw new ArgumentNullException(nameof(cache));
            _options = options?.Value ?? throw new ArgumentNullException(nameof(options));
        }

        public Task HandleAsync(AuthorizationHandlerContext context)
        {
            if (context == default)
            {
                throw new ArgumentNullException(nameof(context));
            }

            if (!context.Requirements.OfType<CreatedByRequirement<T, TId>>().Any())
            {
                return CompletedTask;
            }

            if (context.User.IsInRole("Admin"))
            {
                return CompletedTask;
            }

            if (!(context.Resource is AuthorizationFilterContext filterContext))
            {
                return CompletedTask;
            }

            if (!filterContext.RouteData.Values.ContainsKey("id"))
            {
                return CompletedTask;
            }

            if (context.User.Identity?.IsAuthenticated != true)
            {
                return CompletedTask;
            }

            async Task HandleAsync()
            {
                T model;
                var id = filterContext.RouteData.Values["id"];
                if (_cache.TryGetValue(id.ToString(), out T value))
                {
                    model = value;
                }
                else
                {
                    var redisValue = await _database.StringGetAsync(id.ToString()).ConfigureAwait(false);
                    if (redisValue.IsNullOrEmpty)
                    {
                        var request = new GetRequest<T>(nameof(MongoDB), new[] { id }, _logger);
                        model = await _mediator.Send(request).ConfigureAwait(false);
                        if (model != default)
                        {
                            await _database.StringSetAsync(id.ToString(), Serialize(model)).ConfigureAwait(false);
                        }
                    }
                    else
                    {
                        model = Deserialize<T>(redisValue);
                    }

                    if (model != default)
                    {
                        using var entry = _cache.CreateEntry(id.ToString());
                        entry.Value = model;
                        entry.AbsoluteExpiration = _options.AbsoluteExpiration;
                        entry.AbsoluteExpirationRelativeToNow = _options.AbsoluteExpirationRelativeToNow;
                        entry.SlidingExpiration = _options.SlidingExpiration;
                        foreach (var token in _options.ExpirationTokens)
                        {
                            entry.ExpirationTokens.Add(token);
                        }

                        foreach (var callback in _options.PostEvictionCallbacks)
                        {
                            entry.PostEvictionCallbacks.Add(callback);
                        }

                        entry.Priority = _options.Priority;
                        entry.Size = _options.Size;
                    }
                }

                if (model == default || model.CreatedBy.ToString() == context.User.FindFirstValue(Sub))
                {
                    foreach (var requirement in context.Requirements.OfType<CreatedByRequirement<T, TId>>())
                    {
                        context.Succeed(requirement);
                    }
                }
            }

            return HandleAsync();
        }
    }
}
