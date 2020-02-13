namespace Inventory.NotificationHandlers
{
    using System;
    using System.Threading;
    using System.Threading.Tasks;
    using MediatR;
    using Microsoft.Extensions.Caching.Memory;
    using Microsoft.Extensions.Options;
    using Notifications;
    using StackExchange.Redis;
    using static System.Text.Json.JsonSerializer;

    public class NotificationHandler<T> :
        INotificationHandler<CreateNotification<T>>,
        INotificationHandler<UpdateNotification<T>>,
        INotificationHandler<DeleteNotification>
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

            using (var entry = _cache.CreateEntry(notification.Key))
            {
                entry.Value = notification.Model;
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

            return _database.StringSetAsync(notification.Key, Serialize(notification.Model));
        }

        public Task Handle(UpdateNotification<T> notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            return _database.StringSetAsync(notification.Key, Serialize(notification.Model));
        }

        public Task Handle(DeleteNotification notification, CancellationToken cancellationToken)
        {
            if (notification == default)
            {
                throw new ArgumentNullException(nameof(notification));
            }

            _cache.Remove(notification.Key);
            return _database.KeyDeleteAsync(notification.Key);
        }
    }
}
