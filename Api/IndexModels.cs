namespace Inventory
{
    using System.Collections.Generic;
    using MongoDB.Driver;

    public static class IndexModels
    {
        public static IEnumerable<CreateIndexModel<Asset>> AssetIndexes => new[]
        {
            new CreateIndexModel<Asset>(Builders<Asset>.IndexKeys.Ascending(x => x.Name))
        };
    }
}
