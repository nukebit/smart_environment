using System.ComponentModel.DataAnnotations;

namespace SmartEnvironment.Api.Data;

public class Lokaal
{
    public int Id { get; set; }

    [MaxLength(100)]
    public string Naam { get; set; } = string.Empty;

    public double TemperatureMinimum { get; set; } = 19;
    public double TemperatureMaximum { get; set; } = 23.5;
    public double HumidityMinimum { get; set; } = 40;
    public double HumidityMaximum { get; set; } = 70;
    public double PressureMinimum { get; set; } = 1008;
    public double PressureMaximum { get; set; } = 1028;

    public int GebouwId { get; set; }

    public Gebouw Gebouw { get; set; } = null!;
}
