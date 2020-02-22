namespace Inventory.Notifications
{
    using System;
    using System.Collections.Generic;
    using MediatR;

    public class UpdateRangeNotification<T> : INotification
        where T : class
    {
        public UpdateRangeNotification(IDictionary<object, T> keyValuePairs)
        {
            KeyValuePairs = keyValuePairs ?? throw new ArgumentNullException(nameof(keyValuePairs));
        }

        public IDictionary<object, T> KeyValuePairs { get; }
    }
}
