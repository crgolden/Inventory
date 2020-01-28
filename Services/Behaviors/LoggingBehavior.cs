namespace Inventory.Behaviors
{
    using System;
    using System.Threading;
    using System.Threading.Tasks;
    using Common;
    using MediatR;
    using Microsoft.Extensions.Logging;
    using static System.Guid;

    public class LoggingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
        where TRequest : IEventable
    {
        private readonly ILogger<TRequest> _logger;

        public LoggingBehavior(ILogger<TRequest> logger)
        {
            _logger = logger;
        }

        public Task<TResponse> Handle(TRequest request, CancellationToken cancellationToken, RequestHandlerDelegate<TResponse> next)
        {
            if (request == null)
            {
                throw new ArgumentNullException(nameof(request));
            }

            if (next == default)
            {
                throw new ArgumentNullException(nameof(next));
            }

            async Task<TResponse> Handle()
            {
                using (_logger.BeginScope(NewGuid()))
                {
                    _logger.LogInformation(request.EventId, "Request: {@Request}", request);
                    var response = await next().ConfigureAwait(false);
                    _logger.LogInformation(request.EventId, "Response: {@Response}", response);
                    return response;
                }
            }

            return Handle();
        }
    }
}
