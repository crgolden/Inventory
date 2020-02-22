namespace Inventory.Notifications
{
    using System;
    using MediatR;

    public class UpdateNotification<T> : INotification
        where T : class
    {
        public UpdateNotification(object key, T model)
        {
            Key = key ?? throw new ArgumentNullException(nameof(key));
            Model = model ?? throw new ArgumentNullException(nameof(model));
        }

        public object Key { get; }

        public T Model { get; }
    }
}
