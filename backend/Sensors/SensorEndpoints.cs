using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartEnvironment.Api.Common;
using SmartEnvironment.Api.Data;

namespace SmartEnvironment.Api.Sensors;

public static class SensorEndpoints
{
    public static readonly string[] AvailableDevices =
    [
        "urban-sense-rijswijk-01",
        "urban-sense-rijswijk-02",
        "urban-sense-rijswijk-03"
    ];

    /// <summary>
    /// Wijst een klaslokaal toe aan een van de drie Urban Sense sensoren.
    /// Zo is elk bestaand klaslokaal gegarandeerd voorzien van echte API-sensordata.
    /// </summary>
    public static string ResolveDeviceId(string room)
    {
        if (string.IsNullOrWhiteSpace(room)) return AvailableDevices[0];

        // Specifieke toewijzing voor bekende kernlokalen
        if (room.Contains("2.14")) return AvailableDevices[0];
        if (room.Contains("1.02")) return AvailableDevices[1];
        if (room.Contains("3.05")) return AvailableDevices[2];

        // Voor alle overige lokalen: verdeel deterministisch over de 3 API-sensoren
        var hash = Math.Abs(room.GetHashCode());
        return AvailableDevices[hash % AvailableDevices.Length];
    }

    public static void MapSensorEndpoints(this WebApplication app)
    {
        // Alle sensor-endpoints starten met /api/sensors en vereisen dat de gebruiker is ingelogd.
        var group = app.MapGroup("/api/sensors")
            .RequireAuthorization()
            .DisableCookieRedirect()
            .AddEndpointFilter(ApiFilters.NoCacheFilter);

        // GET /api/sensors/rooms -> lijst van alle klaslokalen met hun gekoppelde sensor
        group.MapGet("/rooms", async (AuthDbContext database) =>
        {
            var lokalen = await database.Lokalen
                .Include(l => l.Gebouw)
                .OrderBy(l => l.Gebouw.Naam)
                .ThenBy(l => l.Naam)
                .ToListAsync();

            var result = lokalen.Select(l => new
            {
                id = l.Id,
                naam = l.Naam,
                gebouwId = l.GebouwId,
                gebouw = l.Gebouw.Naam,
                deviceId = ResolveDeviceId(l.Naam)
            });

            return Results.Ok(result);
        });

        // GET /api/sensors/room-data?room=2.14&period=24u -> actuele én opgeslagen historische metingen voor een specifiek lokaal
        group.MapGet("/room-data", async (
            [FromQuery] string room,
            [FromQuery] string? period,
            [FromQuery] int? limit,
            UrbanSenseService sensorService,
            AuthDbContext database,
            CancellationToken cancellationToken) =>
        {
            var deviceId = ResolveDeviceId(room);
            var latest = await sensorService.GetLatestMeasurementAsync(deviceId, cancellationToken);
            if (latest != null)
            {
                await SensorHistorySyncService.SaveMeasurementsAsync(database, deviceId, [latest], cancellationToken);
            }

            var nowUtc = DateTime.UtcNow;
            var sinceUtc = (period ?? "24u").ToLowerInvariant() switch
            {
                "7d" => nowUtc.AddDays(-7),
                "30d" => nowUtc.AddDays(-30),
                "3m" => nowUtc.AddMonths(-3),
                _ => nowUtc.AddHours(-24)
            };

            var stored = await database.SensorReadings
                .AsNoTracking()
                .Where(r => r.DeviceId == deviceId && r.Timestamp >= sinceUtc)
                .OrderBy(r => r.Timestamp)
                .ToListAsync(cancellationToken);

            // Als de achtergrond-sync net gestart is en de DB nog leeg is voor dit device, haal dan direct de API-buffer op en sla die op
            if (stored.Count == 0)
            {
                var apiTelemetry = await sensorService.GetTelemetryAsync(deviceId, limit ?? 500, cancellationToken);
                if (apiTelemetry.Count > 0)
                {
                    await SensorHistorySyncService.SaveMeasurementsAsync(database, deviceId, apiTelemetry, cancellationToken);
                    stored = await database.SensorReadings
                        .AsNoTracking()
                        .Where(r => r.DeviceId == deviceId && r.Timestamp >= sinceUtc)
                        .OrderBy(r => r.Timestamp)
                        .ToListAsync(cancellationToken);
                }
            }

            var telemetry = stored.Select(r => new UrbanSenseMeasurement
            {
                DeviceId = r.DeviceId,
                Timestamp = DateTime.SpecifyKind(r.Timestamp, DateTimeKind.Utc),
                Temperature = r.Temperature,
                Humidity = r.Humidity,
                Pressure = r.Pressure
            }).ToList();

            var lastMeasurementAt = latest?.Timestamp ?? telemetry.LastOrDefault()?.Timestamp;
            var isOnline = lastMeasurementAt.HasValue
                && (nowUtc - lastMeasurementAt.Value) <= TimeSpan.FromMinutes(5);

            return Results.Ok(new
            {
                room,
                deviceId,
                isOnline,
                lastMeasurementAt,
                latest,
                telemetry
            });
        });

        // GET /api/sensors/devices -> lijst van actieve meetpunten
        group.MapGet("/devices", async (UrbanSenseService sensorService) =>
        {
            var devices = await sensorService.GetDevicesAsync();
            return Results.Ok(devices);
        });

        // GET /api/sensors/devices/{deviceId}/latest -> actuele meting van één meetpunt
        group.MapGet("/devices/{deviceId}/latest", async (
            string deviceId,
            UrbanSenseService sensorService) =>
        {
            var measurement = await sensorService.GetLatestMeasurementAsync(deviceId);
            if (measurement == null)
            {
                return Results.NotFound(new { message = $"Geen actuele meting gevonden voor {deviceId}." });
            }

            return Results.Ok(measurement);
        });

        // GET /api/sensors/devices/{deviceId}/telemetry?limit=100 -> historische meetwaarden voor grafiek
        group.MapGet("/devices/{deviceId}/telemetry", async (
            string deviceId,
            [FromQuery] int? limit,
            UrbanSenseService sensorService) =>
        {
            var measurements = await sensorService.GetTelemetryAsync(deviceId, limit ?? 100);
            return Results.Ok(measurements);
        });
    }
}
