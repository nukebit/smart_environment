using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartEnvironment.Api.Common;
using SmartEnvironment.Api.Data;

namespace SmartEnvironment.Api.Sensors;

public static class SensorEndpoints
{
    private static readonly string[] AvailableDevices =
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

        // GET /api/sensors/room-data?room=2.14&limit=100 -> actuele én historische metingen voor een lokaal
        group.MapGet("/room-data", async (
            [FromQuery] string room,
            [FromQuery] int? limit,
            UrbanSenseService sensorService) =>
        {
            var deviceId = ResolveDeviceId(room);
            var latest = await sensorService.GetLatestMeasurementAsync(deviceId);
            var telemetry = await sensorService.GetTelemetryAsync(deviceId, limit ?? 100);

            return Results.Ok(new
            {
                room,
                deviceId,
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
