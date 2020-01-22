namespace Assets
{
    using System.Collections.Generic;
    using MongoDB.Driver;

    public static class IndexModels
    {
        public static KeyValuePair<string, IEnumerable<CreateIndexModel<Asset>>> AssetIndexes => new KeyValuePair<string, IEnumerable<CreateIndexModel<Asset>>>(
            "Assets",
            new[] { new CreateIndexModel<Asset>(Builders<Asset>.IndexKeys.Ascending(x => x.Name)) });
    }
}
