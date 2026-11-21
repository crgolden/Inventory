namespace Inventory.Tests.Unit.Logging;

using System;
using System.Collections.Generic;
using Inventory.Logging;
using Microsoft.Extensions.Logging;
using Serilog;
using Serilog.Core;
using Serilog.Events;
using Serilog.Extensions.Logging;

[Trait("Category", "Unit")]
public sealed class DuendeLicenseNoticeTests
{
    private const string LicenseValidatorSourceContext = DuendeLicenseNotice.LicenseValidatorSourceContext;
    private const string ErrorValidatingV2LicenseKeyEventName = DuendeLicenseEventConstants.ErrorValidatingV2LicenseKeyEventName;
    private const string LicenseExpiredEventName = DuendeLicenseEventConstants.LicenseExpiredEventName;
    private const string FeatureNotLicensedEventName = DuendeLicenseEventConstants.FeatureNotLicensedEventName;
    private const string QuantizedExceedsLimitEventName = DuendeLicenseEventConstants.QuantizedExceedsLimitEventName;
    private const string QuantizedExceedsGraceEventName = DuendeLicenseEventConstants.QuantizedExceedsGraceEventName;
    private const string LicenseValidUntilEventName = DuendeLicenseEventConstants.LicenseValidUntilEventName;
    private const string LicenseValidEventName = DuendeLicenseEventConstants.LicenseValidEventName;

    private static readonly int DroppedEventIdentifier = Generated.NewEventIdentifier();

    [Fact]
    public void IsNoLicenseConfiguredNotice_DropsTheUnlicensedNotice()
    {
        // Arrange
        var eventId = new EventId(DroppedEventIdentifier, DuendeLicenseNotice.NoValidLicenseKeyEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Error);

        // Assert
        Assert.Empty(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_DropsTheUnlicensedFeatureWarning()
    {
        // Arrange
        var eventId = new EventId(Generated.NewEventIdentifier(), DuendeLicenseNotice.FeatureUsedNoLicenseEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Warning);

        // Assert
        Assert.Empty(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_DropsTheUnlicensedEntitlementCountWarning()
    {
        // Arrange
        var eventId = new EventId(Generated.NewEventIdentifier(), DuendeLicenseNotice.QuantizedNoLicenseEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Warning);

        // Assert
        Assert.Empty(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheMalformedLicenseKeyEventFromTheSameSource()
    {
        // Arrange
        var eventId = new EventId(Generated.NewEventIdentifier(), ErrorValidatingV2LicenseKeyEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Critical);

        // Assert
        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheExpiredLicenseEventFromTheSameSource()
    {
        // Arrange
        var eventId = new EventId(Generated.NewEventIdentifier(), LicenseExpiredEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Error);

        // Assert
        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsAFeatureMissingFromAConfiguredLicense()
    {
        // Arrange
        var eventId = new EventId(Generated.NewEventIdentifier(), FeatureNotLicensedEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Warning);

        // Assert
        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsAnEntitlementBeyondItsLicensedLimit()
    {
        // Arrange
        var eventId = new EventId(Generated.NewEventIdentifier(), QuantizedExceedsLimitEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Warning);

        // Assert
        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsAnEntitlementBeyondItsLicensedGrace()
    {
        // Arrange
        var eventId = new EventId(Generated.NewEventIdentifier(), QuantizedExceedsGraceEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Error);

        // Assert
        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheLicenseValidUntilNotice()
    {
        // Arrange
        var eventId = new EventId(Generated.NewEventIdentifier(), LicenseValidUntilEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Information);

        // Assert
        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheValidLicenseNotice()
    {
        // Arrange
        var eventId = new EventId(Generated.NewEventIdentifier(), LicenseValidEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Information);

        // Assert
        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsADroppedEventNameWhenItComesFromAnotherSource()
    {
        // Arrange
        var sourceContext = $"Contoso.Licensing.{Guid.NewGuid():N}";
        var eventId = new EventId(DroppedEventIdentifier, DuendeLicenseNotice.NoValidLicenseKeyEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(sourceContext, eventId, LogLevel.Error);

        // Assert
        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsAnotherEventCarryingADroppedEventIdentifier()
    {
        // Arrange
        var eventId = new EventId(DroppedEventIdentifier, $"Event{Guid.NewGuid():N}");

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Error);

        // Assert
        Assert.Single(reachedTheSink);
    }

    private static IReadOnlyList<LogEvent> WriteThroughFilter(string sourceContext, EventId eventId, LogLevel logLevel)
    {
        var sink = new CapturingSink();
        var notice = Guid.NewGuid().ToString("N");
        using (var serilogLogger = new LoggerConfiguration()
                   .MinimumLevel.Verbose()
                   .Filter.ByExcluding(DuendeLicenseNotice.IsNoLicenseConfiguredNotice)
                   .WriteTo.Sink(sink)
                   .CreateLogger())
        using (var loggerFactory = new SerilogLoggerFactory(serilogLogger))
        {
            loggerFactory
                .CreateLogger(sourceContext)
                .Log(logLevel, eventId, notice, exception: null, static (state, _) => state);
        }

        return sink.Events;
    }

    private sealed class CapturingSink : ILogEventSink
    {
        private readonly List<LogEvent> _events = [];

        public IReadOnlyList<LogEvent> Events => _events;

        public void Emit(LogEvent logEvent) => _events.Add(logEvent);
    }
}
