namespace Inventory
{
    using System;
    using System.Diagnostics.CodeAnalysis;
    using Common;
    using Microsoft.AspNetCore.Authorization;

    [SuppressMessage("Major Code Smell", "S2326:Unused type parameters should be removed", Justification = "Used for handler typing")]
    public class CreatedByRequirement<T, TId> : IAuthorizationRequirement
        where T : class, ICreatable<TId>
        where TId : IComparable<TId>, IEquatable<TId>
    {
    }
}
