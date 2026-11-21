namespace Inventory.Logging;

using Serilog.Core;
using Serilog.Events;

internal static class DuendeLicenseNotice
{
    internal const string LicenseValidatorSourceContext = "Duende.Private.Licencing.V2.LicenseValidator";
    internal const string NoValidLicenseKeyEventName = "NoValidLicenseKey";
    internal const string FeatureUsedNoLicenseEventName = "FeatureUsedNoLicense";
    internal const string QuantizedNoLicenseEventName = "QuantizedNoLicense";

    internal static readonly string[] NoLicenseConfiguredEventNames =
    [
        NoValidLicenseKeyEventName,
        FeatureUsedNoLicenseEventName,
        QuantizedNoLicenseEventName
    ];

    private const string EventIdPropertyName = "EventId";
    private const string EventNamePropertyName = "Name";

    public static bool IsNoLicenseConfiguredNotice(LogEvent logEvent)
    {
        if (!string.Equals(
                ScalarPropertyOrNull(logEvent, Constants.SourceContextPropertyName),
                LicenseValidatorSourceContext,
                StringComparison.Ordinal))
        {
            return false;
        }

        var eventName = EventNameOrNull(logEvent);

        return eventName is not null
               && NoLicenseConfiguredEventNames.Contains(eventName, StringComparer.Ordinal);
    }

    private static string? ScalarPropertyOrNull(LogEvent logEvent, string propertyName)
    {
        if (logEvent.Properties.TryGetValue(propertyName, out var property)
            && property is ScalarValue { Value: string value })
        {
            return value;
        }

        return null;
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
