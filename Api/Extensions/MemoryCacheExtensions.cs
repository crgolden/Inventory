namespace Inventory.Extensions
{
    using System;
    using Microsoft.Extensions.Caching.Memory;

    /// <summary>A class with methods that extend <see cref="IMemoryCache"/>.</summary>
    public static class MemoryCacheExtensions
    {
        public static void SetCacheEntry<T>(
            this IMemoryCache cache,
            object? key,
            T value,
            MemoryCacheEntryOptions options)
        {
            if (cache == default)
            {
                throw new ArgumentNullException(nameof(cache));
            }

            if (key == default || value == null)
            {
                return;
            }

            using var entry = cache.CreateEntry(key);
            entry.Value = value;
            if (options == default)
            {
                return;
            }

            entry.AbsoluteExpiration = options.AbsoluteExpiration;
            entry.AbsoluteExpirationRelativeToNow = options.AbsoluteExpirationRelativeToNow;
            entry.SlidingExpiration = options.SlidingExpiration;
            foreach (var token in options.ExpirationTokens)
            {
                entry.ExpirationTokens.Add(token);
            }

            foreach (var callback in options.PostEvictionCallbacks)
            {
                entry.PostEvictionCallbacks.Add(callback);
            }

            entry.Priority = options.Priority;
            entry.Size = options.Size;
        }
    }
}
