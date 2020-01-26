namespace Inventory
{
    using System.Collections.Generic;
    using System.Linq;
    using static System.DateTime;
    using static System.Globalization.CultureInfo;
    using static System.Guid;
    using static System.Linq.Enumerable;

    public static class Seeds
    {
        public static IEnumerable<Asset> Assets => Range(0, 5).Select(index => new Asset
        {
            Name = NewGuid().ToString("N", InvariantCulture),
            CreatedDate = Now.AddDays(index * -1)
        });
    }
}
