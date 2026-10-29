using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace SmartEnvironment.Api.Weather;

public record WeatherReading(double Temperature, double Humidity, double Pressure,
    double WindSpeed, DateTimeOffset Time);

// One shared cache and lock for all users of this server.
public sealed class WeatherService(IHttpClientFactory clients, IMemoryCache cache) : IDisposable
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private const string CacheKey = "weather:den-haag";

    public async Task<WeatherReading> GetAsync(CancellationToken cancellationToken)
    {
        if (cache.TryGetValue<WeatherReading>(CacheKey, out var cached)) return cached!;
        await gate.WaitAsync(cancellationToken);
        try
        {
            if (cache.TryGetValue<WeatherReading>(CacheKey, out cached)) return cached!;
            // Den Haag city centre. Surface pressure matches an uncorrected local barometer.
            using var response = await clients.CreateClient("OpenMeteo").GetAsync(
                "v1/forecast?latitude=52.0705&longitude=4.3007&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m&temperature_unit=celsius&wind_speed_unit=kmh&timeformat=unixtime", cancellationToken);
            response.EnsureSuccessStatusCode();
            using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
            var current = json.RootElement.GetProperty("current");
            var units = json.RootElement.GetProperty("current_units");
            foreach (var (name, unit) in new[] { ("temperature_2m", "°C"), ("relative_humidity_2m", "%"), ("surface_pressure", "hPa"), ("wind_speed_10m", "km/h"), ("time", "unixtime") })
                if (units.GetProperty(name).GetString() != unit) throw new JsonException("Unexpected weather unit.");

            var reading = new WeatherReading(
                Read(current, "temperature_2m", -100, 70),
                Read(current, "relative_humidity_2m", 0, 100),
                Read(current, "surface_pressure", 800, 1100),
                Read(current, "wind_speed_10m", 0, 500),
                DateTimeOffset.FromUnixTimeSeconds(current.GetProperty("time").GetInt64()));
            var age = DateTimeOffset.UtcNow - reading.Time;
            if (age > TimeSpan.FromHours(2) || age < -TimeSpan.FromMinutes(30))
                throw new JsonException("Weather timestamp is out of date.");
            cache.Set(CacheKey, reading, TimeSpan.FromMinutes(15));
            return reading;
        }
        finally { gate.Release(); }
    }

    private static double Read(JsonElement data, string name, double min, double max)
    {
        var value = data.GetProperty(name).GetDouble();
        if (!double.IsFinite(value) || value < min || value > max) throw new JsonException("Invalid weather value.");
        return value;
    }

    public void Dispose() => gate.Dispose();
}
