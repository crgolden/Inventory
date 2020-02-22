namespace Inventory.Notifications
{
    using System;
    using System.Collections.Generic;
    using MediatR;

    public class DeleteRangeNotification : INotification
    {
        public DeleteRangeNotification(IReadOnlyCollection<object> keys)
        {
            Keys = keys ?? throw new ArgumentNullException(nameof(keys));
        }

        public IReadOnlyCollection<object> Keys { get; }
    }
}
