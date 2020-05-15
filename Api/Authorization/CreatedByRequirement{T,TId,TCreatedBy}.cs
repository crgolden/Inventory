namespace Inventory.Authorization
{
    using System;
    using System.Collections.Generic;
    using System.Diagnostics.CodeAnalysis;
    using Common;
    using Microsoft.AspNetCore.Authorization;
    using static System.Array;
    using static System.String;

    [SuppressMessage("Major Code Smell", "S2326:Unused type parameters should be removed", Justification = "Used for handler typing")]
    public class CreatedByRequirement<T, TId, TCreatedBy> : IAuthorizationRequirement, INameable
        where T : class, IKeyable<TId>, ICreatable<TCreatedBy>, new()
        where TCreatedBy : IComparable<TCreatedBy>, IEquatable<TCreatedBy>
    {
        public CreatedByRequirement(string name, IReadOnlyCollection<string>? allowedRoles = null)
        {
            if (IsNullOrWhiteSpace(name))
            {
                throw new ArgumentNullException(nameof(name));
            }

            Name = name;
            AllowedRoles = allowedRoles ?? Empty<string>();
        }

        /// <summary>Gets the name of the <see cref="IDataQueryService"/> to use for this requirement.</summary>
        /// <value>The name of the <see cref="IDataQueryService"/> to use for this requirement.</value>
        public string Name { get; }

        /// <summary>Gets the allowed roles.</summary>
        /// <value>The allowed roles.</value>
        public IReadOnlyCollection<string> AllowedRoles { get; }
    }
}
