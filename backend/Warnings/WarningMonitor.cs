using Microsoft.EntityFrameworkCore;
using SmartEnvironment.Api.Data;
using SmartEnvironment.Api.Sensors;

namespace SmartEnvironment.Api.Warnings;

public class WarningMonitor(IServiceScopeFactory scopes, ILogger<WarningMonitor> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        do
        {
            try { await CheckAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Waarschuwingen controleren mislukt."); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    public async Task CheckAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
        var source = scope.ServiceProvider.GetRequiredService<IWarningMeasurementSource>();
        var rooms = await db.Lokalen.Include(l => l.Gebouw).ToListAsync(ct);
        var open = await db.SensorWarnings.Where(w => w.IsOpen).ToListAsync(ct);
        var status = await db.WarningMonitorStatuses.SingleAsync(ct);
        var readings = await source.ReadAsync(rooms, ct);
        bool failed = false;
        foreach (var room in rooms)
        {
            if (!readings.TryGetValue(room.Id, out var reading)) { failed = true; continue; }
            var roomOpen = open.Where(w => w.LokaalId == room.Id && w.IsOpen).ToList();
            // Reassignment starts a separate incident; keep historic alerts and reads.
            var retired = roomOpen.Where(w => reading.DeviceId == null || w.DeviceId != reading.DeviceId).ToList();
            foreach (var previous in retired) previous.IsOpen = false;
            if (retired.Count > 0) await db.SaveChangesAsync(ct);
            roomOpen.RemoveAll(w => !w.IsOpen);
            if (reading.DeviceId == null) continue;
            var measurement = reading.Measurement;
            // Transport errors are not evidence that a device is offline or recovered.
            if (measurement is null) { failed = true; continue; }
            var now = DateTime.UtcNow;
            MeasurementLimit[] limits = [
                new() { Id = "temperature", Minimum = room.TemperatureMinimum, Maximum = room.TemperatureMaximum },
                new() { Id = "humidity", Minimum = room.HumidityMinimum, Maximum = room.HumidityMaximum },
                new() { Id = "pressure", Minimum = room.PressureMinimum, Maximum = room.PressureMaximum }
            ];
            var conditions = WarningEvaluator.Evaluate(measurement, limits, now);
            foreach (var previous in roomOpen)
            {
                if (conditions.Any(c => c.Kind == previous.Kind)) continue;
                // Missing/invalid measurements cannot prove a threshold incident has ended.
                if (previous.Kind.EndsWith("-high") || previous.Kind.EndsWith("-low"))
                {
                    var metric = previous.Kind.Split('-')[0];
                    if (conditions.Any(c => c.Kind is "stale" or "invalid-time" || c.Kind == metric + "-invalid"))
                    {
                        if (!previous.Confirmed) previous.IsOpen = false;
                        continue;
                    }
                    if (measurement.Timestamp <= previous.MeasuredAt) continue;
                }
                previous.IsOpen = false;
            }
            foreach (var condition in conditions)
            {
                var warning = roomOpen.SingleOrDefault(w => w.Kind == condition.Kind);
                if (warning is null)
                {
                    warning = new SensorWarning { LokaalId = room.Id, DeviceId = reading.DeviceId, Room = room.Naam, Building = room.Gebouw.Naam,
                        Kind = condition.Kind, Title = condition.Title, Advice = condition.Advice, Unit = condition.Unit,
                        Value = condition.Value, Limit = condition.Limit, CreatedAt = now,
                        MeasuredAt = measurement.Timestamp, IsOpen = true, Confirmed = condition.Immediate };
                    db.SensorWarnings.Add(warning);
                }
                else if (measurement.Timestamp > warning.MeasuredAt)
                {
                    // Two distinct readings spanning at least one minute; polling a cached sample never confirms an alert.
                    if (!warning.Confirmed && now - warning.CreatedAt >= TimeSpan.FromMinutes(1)) warning.Confirmed = true;
                    warning.MeasuredAt = measurement.Timestamp;
                    warning.Value = condition.Value;
                    warning.Limit = condition.Limit;
                }
            }
        }
        status.Error = failed ? "Sensordata konden niet volledig worden opgehaald. Bestaande meldingen blijven bewaard." : null;
        if (!failed) status.LastSuccessAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}
