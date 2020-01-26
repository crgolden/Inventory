namespace Inventory
{
    using System.Collections.Generic;
    using MongoDB.Bson.Serialization;
    using static MongoDB.Bson.Serialization.BsonClassMap;

    public static class ClassMaps
    {
        public static IEnumerable<KeyValuePair<string, BsonClassMap>> KeyValuePairs => new[]
        {
            new KeyValuePair<string, BsonClassMap>("Assets", RegisterClassMap<Asset>(cm =>
            {
                cm.AutoMap();
                cm.MapIdMember(c => c.Id);
            }))
        };
    }
}
