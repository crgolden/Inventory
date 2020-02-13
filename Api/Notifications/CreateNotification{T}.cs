namespace Inventory.Notifications
{
    using System;
    using MediatR;
    using static System.String;

    public class CreateNotification<T> : INotification
        where T : class
    {
        public CreateNotification(string key, T model)
        {
            if (IsNullOrWhiteSpace(key))
            {
                throw new ArgumentNullException(nameof(key));
            }

            Key = key;
            Model = model ?? throw new ArgumentNullException(nameof(model));
        }

        public string Key { get; }

        public T Model { get; }
    }
}
