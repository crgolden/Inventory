namespace Inventory.Logging;

using Serilog.Core;
using Serilog.Events;

internal static class DuendeLicenseNotice
{
    private const string LicenseValidatorSourceContext = "Duende.Bff.Licensing.LicenseValidator";
    private const string NoLicenseConfiguredEventName = "NoValidLicense";
    private const string EventIdPropertyName = "EventId";
    private const string EventNamePropertyName = "Name";

    public static bool IsNoLicenseConfiguredNotice(LogEvent logEvent)
    {
        return string.Equals(
                   ScalarPropertyOrNull(logEvent, Constants.SourceContextPropertyName),
                   LicenseValidatorSourceContext,
                   StringComparison.Ordinal)
               && string.Equals(
                   EventNameOrNull(logEvent),
                   NoLicenseConfiguredEventName,
                   StringComparison.Ordinal);
    }

    private static string? ScalarPropertyOrNull(LogEvent logEvent, string propertyName)
    {
        return logEvent.Properties.TryGetValue(propertyName, out var property)
               && property is ScalarValue { Value: string value }
            ? value
            : null;
    }

    private static string? EventNameOrNull(LogEvent logEvent)
    {
        if (!logEvent.Properties.TryGetValue(EventIdPropertyName, out var property)
            || property is not StructureValue eventId)
        {
            return null;
        }

        var eventName = eventId.Properties.FirstOrDefault(
            x => string.Equals(x.Name, EventNamePropertyName, StringComparison.Ordinal));

        return eventName?.Value is ScalarValue { Value: string value } ? value : null;
    }
}
