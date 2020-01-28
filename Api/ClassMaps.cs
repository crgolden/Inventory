namespace Inventory
{
    using System.Collections.Generic;
    using MongoDB.Bson.Serialization;

    public static class ClassMaps
    {
        public static IDictionary<string, BsonClassMap> KeyValuePairs => new Dictionary<string, BsonClassMap>
        {
            ["Assets"] = new BsonClassMap<Asset>(cm =>
            {
                cm.AutoMap();
                cm.MapIdMember(c => c.Id);
            })
        };
    }
}
