using SmartEnvironment.Api.Data;
using SmartEnvironment.Api.Sensors;

namespace SmartEnvironment.Api.Warnings;

// Contract for the sensor integration owner. Null DeviceId means explicitly unlinked;
// a linked device with null Measurement means unavailable data, not recovery/offline.
public record WarningRoomReading(string? DeviceId, UrbanSenseMeasurement? Measurement);

public interface IWarningMeasurementSource
{
    Task<IReadOnlyDictionary<int, WarningRoomReading>> ReadAsync(IReadOnlyList<Lokaal> rooms, CancellationToken ct);
}

// Compatibility adapter only. Does not change existing room mapping or graph data.
// When real room/device assignments are introduced, replace this adapter (or the
// shared resolver it calls); the warning evaluator, API and UI remain unchanged.
public class ExistingSensorWarningSource(UrbanSenseService sensors) : IWarningMeasurementSource
{
    public async Task<IReadOnlyDictionary<int, WarningRoomReading>> ReadAsync(IReadOnlyList<Lokaal> rooms, CancellationToken ct)
    {
        var assignments = rooms.ToDictionary(r => r.Id, r => SensorEndpoints.ResolveDeviceId(r.Naam));
        var devices = assignments.Values.Distinct().ToArray();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(10));
        var readings = await Task.WhenAll(devices.Select(id => sensors.GetLatestMeasurementAsync(id, timeout.Token)));
        var byDevice = devices.Zip(readings).ToDictionary(pair => pair.First, pair => pair.Second);
        return assignments.ToDictionary(pair => pair.Key, pair => new WarningRoomReading(pair.Value, byDevice[pair.Value]));
    }
}
