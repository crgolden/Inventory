namespace Inventory.Requests
{
    using System;
    using Common;
    using MediatR;
    using Microsoft.Extensions.Logging;
    using static System.String;

    public class GetRequest<T> : IRequest<T>, INameable
        where T : class?
    {
        private readonly ILogger _logger;

        public GetRequest(string name, object key, ILogger logger)
        {
            if (IsNullOrWhiteSpace(name))
            {
                throw new ArgumentNullException(nameof(name));
            }

            Name = name;
            Key = key ?? throw new ArgumentNullException(nameof(key));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public string Name { get; }

        public object Key { get; }

        public Core.Requests.GetRequest<T> ToCoreRequest()
        {
            return new Core.Requests.GetRequest<T>(Name, new[] { Key }, _logger);
        }
    }
}
