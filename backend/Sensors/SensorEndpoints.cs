using Microsoft.AspNetCore.Mvc;
using SmartEnvironment.Api.Common;

namespace SmartEnvironment.Api.Sensors;

public static class SensorEndpoints
{
    public static void MapSensorEndpoints(this WebApplication app)
    {
        // Alle sensor-endpoints starten met /api/sensors en vereisen dat de gebruiker is ingelogd.
        var group = app.MapGroup("/api/sensors")
            .RequireAuthorization()
            .DisableCookieRedirect()
            .AddEndpointFilter(ApiFilters.NoCacheFilter);

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
