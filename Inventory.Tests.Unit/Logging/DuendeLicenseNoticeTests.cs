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
    private const string DroppedEventName = DuendeLicenseNotice.NoLicenseConfiguredEventName;
    private const string LicenseHasExpiredEventName = DuendeLicenseEventConstants.LicenseHasExpiredEventName;
    private const string LicenseDetailsEventName = DuendeLicenseEventConstants.LicenseDetailsEventName;
    private const string TrialModeWarningEventName = DuendeLicenseEventConstants.TrialModeWarningEventName;
    private const string ErrorValidatingLicenseKeyEventName = DuendeLicenseEventConstants.ErrorValidatingLicenseKeyEventName;

    private static readonly int DroppedEventIdentifier = Generated.NewEventIdentifier();

    [Fact]
    public void IsNoLicenseConfiguredNotice_DropsTheUnlicensedNotice()
    {
        // Arrange
        var eventId = new EventId(DroppedEventIdentifier, DroppedEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Error);

        // Assert
        Assert.Empty(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheExpiredLicenseEventFromTheSameSource()
    {
        // Arrange
        var licenseHasExpiredEventIdentifier = Generated.NewEventIdentifier();
        var eventId = new EventId(licenseHasExpiredEventIdentifier, LicenseHasExpiredEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Warning);

        // Assert
        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheTrialModeSessionLimitEvent()
    {
        // Arrange
        var trialModeWarningEventIdentifier = Generated.NewEventIdentifier();
        var eventId = new EventId(trialModeWarningEventIdentifier, TrialModeWarningEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Error);

        // Assert
        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheMalformedLicenseKeyEventFromTheSameSource()
    {
        // Arrange
        var errorValidatingLicenseKeyEventIdentifier = Generated.NewEventIdentifier();
        var eventId = new EventId(errorValidatingLicenseKeyEventIdentifier, ErrorValidatingLicenseKeyEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Error);

        // Assert
        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheLicenseDetailsEventFromTheSameSource()
    {
        // Arrange
        var licenseDetailsEventIdentifier = Generated.NewEventIdentifier();
        var eventId = new EventId(licenseDetailsEventIdentifier, LicenseDetailsEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Debug);

        // Assert
        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheDroppedEventNameWhenItComesFromAnotherSource()
    {
        // Arrange
        var sourceContext = $"Contoso.Licensing.{Guid.NewGuid():N}";
        var eventId = new EventId(DroppedEventIdentifier, DroppedEventName);

        // Act
        var reachedTheSink = WriteThroughFilter(sourceContext, eventId, LogLevel.Error);

        // Assert
        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsAnotherEventCarryingTheDroppedEventIdentifier()
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
        var messageTemplate = Guid.NewGuid().ToString("N");
        using (var serilogLogger = new LoggerConfiguration()
                   .MinimumLevel.Verbose()
                   .Filter.ByExcluding(DuendeLicenseNotice.IsNoLicenseConfiguredNotice)
                   .WriteTo.Sink(sink)
                   .CreateLogger())
        using (var loggerFactory = new SerilogLoggerFactory(serilogLogger))
        {
            loggerFactory
                .CreateLogger(sourceContext)
                .Log(logLevel, eventId, messageTemplate);
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
