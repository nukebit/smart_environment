using Microsoft.EntityFrameworkCore;
using SmartEnvironment.Api.Data;

namespace SmartEnvironment.Api.Sensors;

/// <summary>
/// Slaat continu alle inkomende metingen van de Urban Sense API op in SQLite,
/// zodat historische periodes (24u, 7d, 30d, 3m) altijd echte meetdata bevatten.
/// </summary>
public class SensorHistorySyncService(
    IServiceScopeFactory scopeFactory,
    ILogger<SensorHistorySyncService> logger) : BackgroundService
{
    private static readonly TimeSpan SyncInterval = TimeSpan.FromSeconds(60);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SyncAllDevicesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Fout tijdens opslaan van historische sensordata.");
            }

            try
            {
                await Task.Delay(SyncInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task SyncAllDevicesAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
        var sensorService = scope.ServiceProvider.GetRequiredService<UrbanSenseService>();

        foreach (var deviceId in SensorEndpoints.AvailableDevices)
        {
            var telemetry = await sensorService.GetTelemetryAsync(deviceId, 500, ct);
            if (telemetry.Count > 0)
            {
                await SaveMeasurementsAsync(db, deviceId, telemetry, ct);
            }
        }
    }

    public static async Task SaveMeasurementsAsync(
        AuthDbContext db,
        string deviceId,
        IEnumerable<UrbanSenseMeasurement> measurements,
        CancellationToken ct = default)
    {
        var candidates = measurements
            .Where(m => m.Timestamp != default)
            .Select(m => new
            {
                Timestamp = DateTime.SpecifyKind(m.Timestamp.ToUniversalTime(), DateTimeKind.Utc),
                m.Temperature,
                m.Humidity,
                m.Pressure
            })
            .GroupBy(m => m.Timestamp)
            .Select(g => g.First())
            .ToList();

        if (candidates.Count == 0) return;

        var minTime = candidates.Min(c => c.Timestamp);
        var maxTime = candidates.Max(c => c.Timestamp);

        var existingTimestamps = (await db.SensorReadings
            .AsNoTracking()
            .Where(r => r.DeviceId == deviceId && r.Timestamp >= minTime && r.Timestamp <= maxTime)
            .Select(r => r.Timestamp)
            .ToListAsync(ct))
            .Select(t => DateTime.SpecifyKind(t, DateTimeKind.Utc))
            .ToHashSet();

        var newRows = candidates
            .Where(c => !existingTimestamps.Contains(c.Timestamp))
            .Select(c => new SensorReading
            {
                DeviceId = deviceId,
                Timestamp = c.Timestamp,
                Temperature = c.Temperature,
                Humidity = c.Humidity,
                Pressure = c.Pressure
            })
            .ToList();

        if (newRows.Count == 0) return;

        db.SensorReadings.AddRange(newRows);
        await db.SaveChangesAsync(ct);
    }
}

