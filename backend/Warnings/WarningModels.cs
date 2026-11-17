namespace SmartEnvironment.Api.Warnings;

public class MeasurementLimit
{
    public string Id { get; set; } = "";
    public double Minimum { get; set; }
    public double Maximum { get; set; }
}

public class SensorWarning
{
    public int Id { get; set; }
    public int LokaalId { get; set; }
    public string? DeviceId { get; set; }
    public string Room { get; set; } = "";
    public string Building { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Title { get; set; } = "";
    public string Advice { get; set; } = "";
    public string Unit { get; set; } = "";
    public double? Value { get; set; }
    public double? Limit { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime MeasuredAt { get; set; }
    // Internal deduplication state; never a user-facing status.
    public bool IsOpen { get; set; }
    public bool Confirmed { get; set; }
}

public class WarningRead
{
    public int WarningId { get; set; }
    public string UserId { get; set; } = "";
    public DateTime ReadAt { get; set; }
}

public class WarningMonitorStatus
{
    public int Id { get; set; } = 1;
    public DateTime? LastSuccessAt { get; set; }
    public string? Error { get; set; }
}
