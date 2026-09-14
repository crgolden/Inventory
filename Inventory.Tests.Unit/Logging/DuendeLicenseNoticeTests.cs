namespace Inventory.Tests.Unit.Logging;

using System;
using System.Collections.Generic;
using Inventory.Logging;
using Microsoft.Extensions.Logging;
using Serilog;
using Serilog.Core;
using Serilog.Events;
using static Inventory.Tests.Unit.TestSupport.TestValues;

[Trait("Category", "Unit")]
public sealed class DuendeLicenseNoticeTests
{
    private const string LicenseValidatorSourceContext = DuendeLicenseNotice.LicenseValidatorSourceContext;
    private const string DroppedEventName = DuendeLicenseNotice.NoLicenseConfiguredEventName;
    private const string LicenseHasExpiredEventName = DuendeLicenseEventConstants.LicenseHasExpiredEventName;
    private const string LicenseDetailsEventName = DuendeLicenseEventConstants.LicenseDetailsEventName;
    private const string TrialModeWarningEventName = DuendeLicenseEventConstants.TrialModeWarningEventName;
    private const string ErrorValidatingLicenseKeyEventName = DuendeLicenseEventConstants.ErrorValidatingLicenseKeyEventName;

    private static readonly int DroppedEventIdentifier = NewEventIdentifier();

    [Fact]
    public void IsNoLicenseConfiguredNotice_DropsTheUnlicensedNotice()
    {
        var eventId = new EventId(DroppedEventIdentifier, DroppedEventName);

        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Error);

        Assert.Empty(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheExpiredLicenseEventFromTheSameSource()
    {
        var licenseHasExpiredEventIdentifier = NewEventIdentifier();
        var eventId = new EventId(licenseHasExpiredEventIdentifier, LicenseHasExpiredEventName);

        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Warning);

        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheTrialModeSessionLimitEvent()
    {
        var trialModeWarningEventIdentifier = NewEventIdentifier();
        var eventId = new EventId(trialModeWarningEventIdentifier, TrialModeWarningEventName);

        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Error);

        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheMalformedLicenseKeyEventFromTheSameSource()
    {
        var errorValidatingLicenseKeyEventIdentifier = NewEventIdentifier();
        var eventId = new EventId(errorValidatingLicenseKeyEventIdentifier, ErrorValidatingLicenseKeyEventName);

        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Error);

        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheLicenseDetailsEventFromTheSameSource()
    {
        var licenseDetailsEventIdentifier = NewEventIdentifier();
        var eventId = new EventId(licenseDetailsEventIdentifier, LicenseDetailsEventName);

        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Debug);

        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheDroppedEventNameWhenItComesFromAnotherSource()
    {
        var sourceContext = $"Contoso.Licensing.{Guid.NewGuid():N}";
        var eventId = new EventId(DroppedEventIdentifier, DroppedEventName);

        var reachedTheSink = WriteThroughFilter(sourceContext, eventId, LogLevel.Error);

        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsAnotherEventCarryingTheDroppedEventIdentifier()
    {
        var eventId = new EventId(DroppedEventIdentifier, $"Event{Guid.NewGuid():N}");

        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Error);

        Assert.Single(reachedTheSink);
    }

    private static IReadOnlyList<LogEvent> WriteThroughFilter(string sourceContext, EventId eventId, LogLevel logLevel)
    {
        var sink = new CapturingSink();
        using (var serilogLogger = new LoggerConfiguration()
                   .MinimumLevel.Verbose()
                   .Filter.ByExcluding(DuendeLicenseNotice.IsNoLicenseConfiguredNotice)
                   .WriteTo.Sink(sink)
                   .CreateLogger())
        using (var loggerFactory = LoggerFactory.Create(loggingBuilder => loggingBuilder
                   .SetMinimumLevel(LogLevel.Trace)
                   .AddSerilog(serilogLogger)))
        {
            var messageTemplate = Guid.NewGuid().ToString("N");

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
