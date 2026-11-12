using System.Text.Json.Serialization;

namespace SmartEnvironment.Api.Sensors;

/// <summary>
/// Het antwoord van de school-API wanneer we om alle meetpunten (devices) vragen.
/// </summary>
public class UrbanSenseDeviceListResponse
{
    [JsonPropertyName("count")]
    public int Count { get; set; }

    [JsonPropertyName("devices")]
    public List<UrbanSenseDeviceItem> Devices { get; set; } = [];
}

public class UrbanSenseDeviceItem
{
    [JsonPropertyName("deviceId")]
    public string DeviceId { get; set; } = string.Empty;
}

/// <summary>
/// Eén losse meting (temperatuur, luchtvochtigheid, luchtdruk).
/// </summary>
public class UrbanSenseMeasurement
{
    [JsonPropertyName("deviceId")]
    public string DeviceId { get; set; } = string.Empty;

    [JsonPropertyName("deviceName")]
    public string? DeviceName { get; set; }

    [JsonPropertyName("timestamp")]
    public DateTime Timestamp { get; set; }

    [JsonPropertyName("temperature")]
    public double? Temperature { get; set; }

    [JsonPropertyName("humidity")]
    public double? Humidity { get; set; }

    [JsonPropertyName("pressure")]
    public double? Pressure { get; set; }
}

/// <summary>
/// Het antwoord met meerdere historische metingen tegelijk (telemetry).
/// </summary>
public class UrbanSenseTelemetryResponse
{
    [JsonPropertyName("deviceId")]
    public string DeviceId { get; set; } = string.Empty;

    [JsonPropertyName("deviceName")]
    public string? DeviceName { get; set; }

    [JsonPropertyName("count")]
    public int Count { get; set; }

    [JsonPropertyName("measurements")]
    public List<UrbanSenseMeasurement> Measurements { get; set; } = [];
}
