namespace Inventory.NotificationHandlers
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading;
    using System.Threading.Tasks;
    using Common;
    using Extensions;
    using MediatR;
    using Microsoft.Extensions.Caching.Memory;
    using Microsoft.Extensions.Options;
    using Notifications;
    using StackExchange.Redis;
    using static System.Text.Json.JsonSerializer;
    using static StackExchange.Redis.CommandFlags;

    public class NotificationHandler<T, TId> :
        INotificationHandler<CreateNotification<T, TId>>,
        INotificationHandler<CreateRangeNotification<T, TId>>,
        INotificationHandler<UpdateNotification<T, TId>>,
        INotificationHandler<UpdateRangeNotification<T, TId>>,
        INotificationHandler<DeleteNotification<TId>>,
        INotificationHandler<DeleteRangeNotification<TId>>,
        INotificationHandler<GetRangeNotification<T, TId>>
        where T : class, IKeyable<TId>
        where TId : notnull
    {
        private readonly IDatabase _database;
        private readonly IMemoryCache _cache;
        private readonly MemoryCacheEntryOptions _options;

        public NotificationHandler(
            IConnectionMultiplexer redis,
            IMemoryCache cache,
            IOptions<MemoryCacheEntryOptions> options)
        {
            if (redis == default)
            {
                throw new ArgumentNullException(nameof(redis));
            }

            _database = redis.GetDatabase();
            _cache = cache ?? throw new ArgumentNullException(nameof(cache));
            _options = options?.Value ?? throw new ArgumentNullException(nameof(options));
        }

        public Task Handle(CreateNotification<T, TId> notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            _cache.SetCacheEntry(notification.Key, notification.Value, _options);
            return _database.StringSetAsync(notification.Key.ToString(), Serialize(notification.Value), flags: FireAndForget);
        }

        public Task Handle(CreateRangeNotification<T, TId> notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            foreach (var (key, value) in notification.KeyValuePairs)
            {
                _cache.SetCacheEntry(key, value, _options);
            }

            var values = notification.KeyValuePairs.Select(x => new KeyValuePair<RedisKey, RedisValue>(x.Key.ToString(), Serialize(x.Value)));
            return _database.StringSetAsync(values.ToArray(), flags: FireAndForget);
        }

        public Task Handle(UpdateNotification<T, TId> notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            _cache.SetCacheEntry(notification.Key, notification.Value, _options);
            return _database.StringSetAsync(notification.Key.ToString(), Serialize(notification.Value), flags: FireAndForget);
        }

        public Task Handle(UpdateRangeNotification<T, TId> notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            foreach (var (key, value) in notification.KeyValuePairs)
            {
                _cache.SetCacheEntry(key, value, _options);
            }

            var values = notification.KeyValuePairs.Select(x => new KeyValuePair<RedisKey, RedisValue>(x.Key.ToString(), Serialize(x.Value)));
            return _database.StringSetAsync(values.ToArray(), flags: FireAndForget);
        }

        public Task Handle(DeleteNotification<TId> notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            _cache.Remove(notification.Key);
            return _database.KeyDeleteAsync(notification.Key.ToString(), FireAndForget);
        }

        public Task Handle(DeleteRangeNotification<TId> notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            foreach (var key in notification.Keys)
            {
                _cache.Remove(key);
            }

            return _database.KeyDeleteAsync(notification.Keys.Select<TId, RedisKey>(x => x.ToString()).ToArray(), FireAndForget);
        }

        public Task Handle(GetRangeNotification<T, TId> notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            foreach (var (key, value) in notification.KeyValuePairs)
            {
                _cache.SetCacheEntry(key, value, _options);
            }

            var values = notification.KeyValuePairs.Select(x => new KeyValuePair<RedisKey, RedisValue>(x.Key.ToString(), Serialize(x.Value)));
            return _database.StringSetAsync(values.ToArray(), flags: FireAndForget);
        }
    }
}
