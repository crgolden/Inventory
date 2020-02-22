namespace Inventory.Notifications
{
    using System;
    using MediatR;

    public class CreateNotification<T> : INotification
        where T : class
    {
        public CreateNotification(object key, T model)
        {
            Key = key ?? throw new ArgumentNullException(nameof(key));
            Model = model ?? throw new ArgumentNullException(nameof(model));
        }

        public object Key { get; }

        public T Model { get; }
    }
}
