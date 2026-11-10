using System.Net.Http.Json;
using Microsoft.Extensions.Caching.Memory;

namespace SmartEnvironment.Api.Sensors;

/// <summary>
/// Deze service is het "doorgeefluik" tussen onze applicatie en de school-sensoren op Azure.
/// </summary>
public class UrbanSenseService
{
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly ILogger<UrbanSenseService> _logger;
    private readonly string _baseUrl;
    private readonly string _apiKey;

    public UrbanSenseService(
        HttpClient httpClient,
        IConfiguration configuration,
        IMemoryCache cache,
        ILogger<UrbanSenseService> logger)
    {
        _httpClient = httpClient;
        _cache = cache;
        _logger = logger;

        _baseUrl = configuration["UrbanSense:BaseUrl"] 
                   ?? "https://urban-sense-api.azure-api.net/urban-sense";
        _apiKey = configuration["UrbanSense:ApiKey"] ?? string.Empty;

        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            _logger.LogWarning("Geen UrbanSense:ApiKey ingesteld in user-secrets!");
        }
    }

    /// <summary>
    /// Haalt de lijst met beschikbare sensoren/meetpunten op (bijv. urban-sense-rijswijk-01).
    /// Bewaart het antwoord 60 seconden in het geheugen zodat we de school-server niet overbelasten.
    /// </summary>
    public async Task<List<string>> GetDevicesAsync(CancellationToken cancellationToken = default)
    {
        const string cacheKey = "urbansense:devices";

        if (_cache.TryGetValue(cacheKey, out List<string>? cachedDevices) && cachedDevices != null)
        {
            return cachedDevices;
        }

        try
        {
            using var request = CreateRequest(HttpMethod.Get, $"{_baseUrl}/devices");
            using var response = await _httpClient.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Fout bij ophalen meetpunten van school-API: {StatusCode}", response.StatusCode);
                return [];
            }

            var result = await response.Content.ReadFromJsonAsync<UrbanSenseDeviceListResponse>(cancellationToken: cancellationToken);
            var deviceIds = result?.Devices.Select(d => d.DeviceId).ToList() ?? [];

            _cache.Set(cacheKey, deviceIds, TimeSpan.FromSeconds(60));
            return deviceIds;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kan geen verbinding maken met de school-sensoren");
            return [];
        }
    }

    /// <summary>
    /// Haalt de meest recente meting op van één specifiek meetpunt.
    /// Bewaart het antwoord 15 seconden in het geheugen.
    /// </summary>
    public async Task<UrbanSenseMeasurement?> GetLatestMeasurementAsync(string deviceId, CancellationToken cancellationToken = default)
    {
        string cacheKey = $"urbansense:latest:{deviceId}";

        if (_cache.TryGetValue(cacheKey, out UrbanSenseMeasurement? cachedMeasurement))
        {
            return cachedMeasurement;
        }

        try
        {
            using var request = CreateRequest(HttpMethod.Get, $"{_baseUrl}/devices/{Uri.EscapeDataString(deviceId)}/latest");
            using var response = await _httpClient.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Kon laatste meting voor {DeviceId} niet ophalen: {StatusCode}", deviceId, response.StatusCode);
                return null;
            }

            var measurement = await response.Content.ReadFromJsonAsync<UrbanSenseMeasurement>(cancellationToken: cancellationToken);
            if (measurement != null)
            {
                _cache.Set(cacheKey, measurement, TimeSpan.FromSeconds(15));
            }

            return measurement;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Fout bij ophalen van laatste meting voor {DeviceId}", deviceId);
            return null;
        }
    }

    /// <summary>
    /// Haalt historische metingen op voor de grafiek (standaard maximaal 100 metingen).
    /// Bewaart het antwoord 30 seconden in het geheugen.
    /// </summary>
    public async Task<List<UrbanSenseMeasurement>> GetTelemetryAsync(string deviceId, int limit = 100, CancellationToken cancellationToken = default)
    {
        // De school-API accepteert maximaal 500 metingen per verzoek
        limit = Math.Clamp(limit, 1, 500);

        string cacheKey = $"urbansense:telemetry:{deviceId}:{limit}";

        if (_cache.TryGetValue(cacheKey, out List<UrbanSenseMeasurement>? cachedList) && cachedList != null)
        {
            return cachedList;
        }

        try
        {
            using var request = CreateRequest(HttpMethod.Get, $"{_baseUrl}/devices/{Uri.EscapeDataString(deviceId)}/telemetry?limit={limit}");
            using var response = await _httpClient.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Kon telemetrie voor {DeviceId} niet ophalen: {StatusCode}", deviceId, response.StatusCode);
                return [];
            }

            var result = await response.Content.ReadFromJsonAsync<UrbanSenseTelemetryResponse>(cancellationToken: cancellationToken);
            var measurements = result?.Measurements ?? [];

            _cache.Set(cacheKey, measurements, TimeSpan.FromSeconds(30));
            return measurements;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Fout bij ophalen van telemetrie voor {DeviceId}", deviceId);
            return [];
        }
    }

    /// <summary>
    /// Maakt een HTTP-verzoek aan en stelt de geheime Ocp-Apim-Subscription-Key header in.
    /// </summary>
    private HttpRequestMessage CreateRequest(HttpMethod method, string url)
    {
        var request = new HttpRequestMessage(method, url);
        if (!string.IsNullOrWhiteSpace(_apiKey))
        {
            request.Headers.Add("Ocp-Apim-Subscription-Key", _apiKey);
        }
        return request;
    }
}
