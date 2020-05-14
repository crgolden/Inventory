namespace Inventory.Notifications
{
    using System;
    using System.Collections.Generic;
    using MediatR;

    public class DeleteRangeNotification<TId> : INotification
        where TId : notnull
    {
        public DeleteRangeNotification(IReadOnlyCollection<TId> keys)
        {
            Keys = keys ?? throw new ArgumentNullException(nameof(keys));
        }

        public IReadOnlyCollection<TId> Keys { get; }
    }
}
