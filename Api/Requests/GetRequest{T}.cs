namespace Inventory.Requests
{
    using System;
    using Common;
    using Core.Requests;
    using MediatR;
    using Microsoft.Extensions.Logging;
    using static System.String;

    public class GetRequest<T> : ScopeableRequest, IRequest<T>, INameable
        where T : class?
    {
        public GetRequest(string name, object key, ILogger logger)
            : base(logger)
        {
            if (IsNullOrWhiteSpace(name))
            {
                throw new ArgumentNullException(nameof(name));
            }

            Name = name;
            Key = key ?? throw new ArgumentNullException(nameof(key));
        }

        public string Name { get; }

        public object Key { get; }

        public Core.Requests.GetRequest<T> ToCoreRequest()
        {
            return new Core.Requests.GetRequest<T>(Name, new[] { Key }, Logger);
        }
    }
}
