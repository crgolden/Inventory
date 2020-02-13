namespace Inventory.RequestHandlers
{
    using System;
    using System.Threading;
    using System.Threading.Tasks;
    using MediatR;
    using StackExchange.Redis;
    using static System.Text.Json.JsonSerializer;

    public class RequestHandler<T> :
        IRequestHandler<Requests.GetRequest<T>, T>
        where T : class?
    {
        private readonly IMediator _mediator;
        private readonly IDatabase _database;

        public RequestHandler(IMediator mediator, IConnectionMultiplexer redis)
        {
            _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
            if (redis == default)
            {
                throw new ArgumentNullException(nameof(redis));
            }

            _database = redis.GetDatabase();
        }

        public Task<T> Handle(Requests.GetRequest<T> request, CancellationToken cancellationToken)
        {
            if (request == default)
            {
                throw new ArgumentNullException(nameof(request));
            }

            async Task<T> Handle()
            {
                T model;
                var redisValue = await _database.StringGetAsync(request.Key.ToString()).ConfigureAwait(false);
                if (redisValue.IsNullOrEmpty)
                {
                    model = await _mediator.Send(request.ToCoreRequest(), cancellationToken).ConfigureAwait(false);
                    if (model != default)
                    {
                        await _database.StringSetAsync(request.Key.ToString(), Serialize(model)).ConfigureAwait(false);
                    }
                }
                else
                {
                    model = Deserialize<T>(redisValue);
                }

                return model;
            }

            return Handle();
        }
    }
}
