namespace Inventory.Notifications
{
    using System;
    using MediatR;

    public class DeleteNotification : INotification
    {
        public DeleteNotification(object key)
        {
            Key = key ?? throw new ArgumentNullException(nameof(key));
        }

        public object Key { get; }
    }
}
