namespace Inventory.Tests.E2E.Infrastructure;

[CollectionDefinition(Name)]
public sealed class E2ECollection : ICollectionFixture<PlaywrightFixture>
{
    public const string Name = "E2E";
}
