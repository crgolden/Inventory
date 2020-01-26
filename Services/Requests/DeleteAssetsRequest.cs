namespace Inventory.Requests
{
    using System;
    using System.Collections.Generic;
    using Common;
    using MediatR;
    using static System.String;

    public class DeleteAssetsRequest : IRequest, INameable
    {
        public DeleteAssetsRequest(string name, Guid[] ids)
        {
            if (IsNullOrWhiteSpace(name))
            {
                throw new ArgumentNullException(nameof(name));
            }

            Name = name;
            Ids = ids ?? throw new ArgumentNullException(nameof(ids));
        }

        public string Name { get; }

        public IReadOnlyCollection<Guid> Ids { get; }
    }
}