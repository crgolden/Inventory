namespace Inventory.Notifications
{
    using System;
    using Common;
    using MediatR;

    public class CreateNotification<T, TId> : INotification
        where T : class, IKeyable<TId>
        where TId : notnull
    {
        public CreateNotification(TId key, T value)
        {
            Key = key ?? throw new ArgumentNullException(nameof(key));
            Value = value ?? throw new ArgumentNullException(nameof(value));
        }

        public TId Key { get; }

        public T Value { get; }
    }
}
