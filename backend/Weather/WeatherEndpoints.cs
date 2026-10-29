using System.Text.Json;
using SmartEnvironment.Api.Common;

namespace SmartEnvironment.Api.Weather;

public static class WeatherEndpoints
{
    public static void MapWeatherEndpoints(this WebApplication app)
    {
        app.MapGet("/api/weather/current", async (WeatherService weather, ILogger<WeatherService> logger, CancellationToken cancellationToken) =>
        {
            try { return Results.Ok(await weather.GetAsync(cancellationToken)); }
            catch (Exception ex) when (ex is HttpRequestException or JsonException or KeyNotFoundException
                or InvalidOperationException or FormatException or ArgumentOutOfRangeException
                || ex is OperationCanceledException && !cancellationToken.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Open-Meteo weather request failed.");
                return Results.Problem(statusCode: 503, title: "Weergegevens tijdelijk niet beschikbaar.");
            }
        }).RequireAuthorization().DisableCookieRedirect().AddEndpointFilter(ApiFilters.NoCacheFilter);
    }
}
