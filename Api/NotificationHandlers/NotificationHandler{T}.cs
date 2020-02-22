namespace Inventory.NotificationHandlers
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading;
    using System.Threading.Tasks;
    using MediatR;
    using Microsoft.Extensions.Caching.Memory;
    using Microsoft.Extensions.Options;
    using Notifications;
    using StackExchange.Redis;
    using static System.String;
    using static System.Text.Json.JsonSerializer;

    public class NotificationHandler<T> :
        INotificationHandler<CreateNotification<T>>,
        INotificationHandler<CreateRangeNotification<T>>,
        INotificationHandler<UpdateNotification<T>>,
        INotificationHandler<UpdateRangeNotification<T>>,
        INotificationHandler<DeleteNotification>,
        INotificationHandler<DeleteRangeNotification>,
        INotificationHandler<GetRangeNotification<T>>
        where T : class
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

        public Task Handle(CreateNotification<T> notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            SetMemoryCache(notification.Key.ToString(), notification.Model);
            return _database.StringSetAsync(notification.Key.ToString(), Serialize(notification.Model));
        }

        public Task Handle(CreateRangeNotification<T> notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            foreach (var (key, value) in notification.KeyValuePairs)
            {
                SetMemoryCache(key.ToString(), value);
            }

            var values = notification.KeyValuePairs.Select(x => new KeyValuePair<RedisKey, RedisValue>(x.Key.ToString(), Serialize(x.Value)));
            return _database.StringSetAsync(values.ToArray());
        }

        public Task Handle(UpdateNotification<T> notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            return _database.StringSetAsync(notification.Key.ToString(), Serialize(notification.Model));
        }

        public Task Handle(UpdateRangeNotification<T> notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            foreach (var (key, value) in notification.KeyValuePairs)
            {
                SetMemoryCache(key.ToString(), value);
            }

            var values = notification.KeyValuePairs.Select(x => new KeyValuePair<RedisKey, RedisValue>(x.Key.ToString(), Serialize(x.Value)));
            return _database.StringSetAsync(values.ToArray());
        }

        public Task Handle(DeleteNotification notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            _cache.Remove(notification.Key);
            return _database.KeyDeleteAsync(notification.Key.ToString());
        }

        public Task Handle(GetRangeNotification<T> notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            var values = notification.KeyValuePairs.Select(x => new KeyValuePair<RedisKey, RedisValue>(x.Key.ToString(), Serialize(x.Value)));
            return _database.StringSetAsync(values.ToArray());
        }

        public Task Handle(DeleteRangeNotification notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            foreach (var key in notification.Keys)
            {
                _cache.Remove(key);
            }

            return _database.KeyDeleteAsync(notification.Keys.Select<object, RedisKey>(x => x.ToString()).ToArray());
        }

        private void SetMemoryCache(string? key, T? value)
        {
            if (IsNullOrEmpty(key) || value == default)
            {
                return;
            }

            using var entry = _cache.CreateEntry(key);
            entry.Value = value;
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
}
