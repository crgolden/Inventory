namespace Inventory.Notifications
{
    using System;
    using MediatR;
    using static System.String;

    public class DeleteNotification : INotification
    {
        public DeleteNotification(string key)
        {
            if (IsNullOrWhiteSpace(key))
            {
                throw new ArgumentNullException(nameof(key));
            }

            Key = key;
        }

        public string Key { get; }
    }
}
