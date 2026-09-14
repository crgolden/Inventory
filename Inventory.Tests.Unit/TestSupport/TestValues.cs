namespace Inventory.Tests.Unit.TestSupport;

internal static class TestValues
{
    internal static string NewSettingToken() => Guid.NewGuid().ToString("N");

    internal static int NewEventIdentifier() => Random.Shared.Next();
}
