namespace Inventory.Models
{
    using JetBrains.Annotations;
    using Microsoft.AspNet.OData.Builder;
    using Microsoft.AspNetCore.Mvc;

    [UsedImplicitly]
    public class ModelConfiguration : IModelConfiguration
    {
        public void Apply(ODataModelBuilder builder, ApiVersion apiVersion)
        {
            builder?.EntitySet<Asset>("Assets").EntityType.HasKey(e => e.Id);
            builder?.EntitySet<Asset>("Asset").EntityType.HasKey(e => e.Id);
        }
    }
}
