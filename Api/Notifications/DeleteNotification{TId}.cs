namespace Inventory.Notifications
{
    using System;
    using MediatR;

    public class DeleteNotification<TId> : INotification
        where TId : notnull
    {
        public DeleteNotification(TId key)
        {
            Key = key ?? throw new ArgumentNullException(nameof(key));
        }

        public TId Key { get; }
    }
}
