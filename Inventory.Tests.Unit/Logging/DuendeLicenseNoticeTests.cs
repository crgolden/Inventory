namespace Inventory.Tests.Unit.Logging;

using System;
using System.Collections.Generic;
using Inventory.Logging;
using Microsoft.Extensions.Logging;
using Serilog;
using Serilog.Core;
using Serilog.Events;

[Trait("Category", "Unit")]
public sealed class DuendeLicenseNoticeTests
{
    private const string LicenseValidatorSourceContext = "Duende.Bff.Licensing.LicenseValidator";
    private const int NoValidLicenseEventId = 767400809;
    private const int LicenseHasExpiredEventId = 770251973;
    private const int TrialModeWarningEventId = 875645872;
    private const int ErrorValidatingLicenseKeyEventId = 197645874;

    [Fact]
    public void IsNoLicenseConfiguredNotice_DropsTheUnlicensedNotice()
    {
        var eventId = new EventId(NoValidLicenseEventId, "NoValidLicense");

        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Error);

        Assert.Empty(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheExpiredLicenseEventFromTheSameSource()
    {
        var eventId = new EventId(LicenseHasExpiredEventId, "LicenseHasExpired");

        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Warning);

        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheTrialModeSessionLimitEvent()
    {
        var eventId = new EventId(TrialModeWarningEventId, "TrialModeWarning");

        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Error);

        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheMalformedLicenseKeyEventFromTheSameSource()
    {
        var eventId = new EventId(ErrorValidatingLicenseKeyEventId, "ErrorValidatingLicenseKey");

        var reachedTheSink = WriteThroughFilter(LicenseValidatorSourceContext, eventId, LogLevel.Error);

        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsTheDroppedEventNameWhenItComesFromAnotherSource()
    {
        var sourceContext = $"Contoso.Licensing.{Guid.NewGuid():N}";
        var eventId = new EventId(NoValidLicenseEventId, "NoValidLicense");

        var reachedTheSink = WriteThroughFilter(sourceContext, eventId, LogLevel.Error);

        Assert.Single(reachedTheSink);
    }

    [Fact]
    public void IsNoLicenseConfiguredNotice_KeepsAnotherEventCarryingTheDroppedEventIdentifier()
    {
        var eventId = new EventId(NoValidLicenseEventId, $"Event{Guid.NewGuid():N}");

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
            loggerFactory
                .CreateLogger(sourceContext)
                .Log(logLevel, eventId, "Please start a conversation with us: https://duende.link/l/bff/contact");
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
