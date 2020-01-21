namespace Assets
{
    using System.Collections.Generic;
    using System.Linq;
    using static System.DateTime;
    using static System.Linq.Enumerable;

    public static class Seeds
    {
        public static IEnumerable<Asset> Assets => Range(1, 5).Select(index => new Asset
        {
            CreatedDate = Now.AddDays(index)
        });
    }
}
