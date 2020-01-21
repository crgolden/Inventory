namespace Assets
{
    using Microsoft.AspNet.OData.Builder;
    using Microsoft.AspNetCore.Mvc;

    public class ModelConfiguration : IModelConfiguration
    {
        public void Apply(ODataModelBuilder builder, ApiVersion apiVersion)
        {
            var assets = builder?.EntitySet<Asset>("Assets").EntityType;
            assets?.HasKey(e => e.Id);
            var asset = builder?.EntitySet<Asset>("Asset").EntityType;
            asset?.HasKey(e => e.Id);
        }
    }
}
