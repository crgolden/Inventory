namespace Inventory.Notifications
{
    using System;
    using System.Collections.Generic;
    using Common;
    using MediatR;

    public class GetRangeNotification<T, TId> : INotification
        where T : class, IKeyable<TId>
        where TId : notnull
    {
        public GetRangeNotification(IDictionary<TId, T> keyValuePairs)
        {
            KeyValuePairs = keyValuePairs ?? throw new ArgumentNullException(nameof(keyValuePairs));
        }

        public IDictionary<TId, T> KeyValuePairs { get; }
    }
}
