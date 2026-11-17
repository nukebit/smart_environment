using System.ComponentModel.DataAnnotations;

namespace SmartEnvironment.Api.Lokalen;

public class LokaalRequest : IValidatableObject
{
    [Required(ErrorMessage = "Vul een lokaalnaam in.")]
    [StringLength(100, ErrorMessage = "De lokaalnaam mag maximaal 100 tekens bevatten.")]
    public string Naam { get; set; } = string.Empty;

    [Required(ErrorMessage = "Selecteer een gebouw.")]
    [Range(1, int.MaxValue, ErrorMessage = "Selecteer een gebouw.")]
    public int? GebouwId { get; set; }
    [Required(ErrorMessage = "Vul alle onder- en bovengrenzen in.")]
    public double? TemperatureMinimum { get; set; }
    [Required(ErrorMessage = "Vul alle onder- en bovengrenzen in.")]
    public double? TemperatureMaximum { get; set; }
    [Required(ErrorMessage = "Vul alle onder- en bovengrenzen in.")]
    public double? HumidityMinimum { get; set; }
    [Required(ErrorMessage = "Vul alle onder- en bovengrenzen in.")]
    public double? HumidityMaximum { get; set; }
    [Required(ErrorMessage = "Vul alle onder- en bovengrenzen in.")]
    public double? PressureMinimum { get; set; }
    [Required(ErrorMessage = "Vul alle onder- en bovengrenzen in.")]
    public double? PressureMaximum { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        var ranges = new[] { ("temperature", TemperatureMinimum, TemperatureMaximum), ("humidity", HumidityMinimum, HumidityMaximum), ("pressure", PressureMinimum, PressureMaximum) };
        foreach (var (id, min, max) in ranges)
        {
            if (min is not double low || max is not double high) continue;
            if (!double.IsFinite(low) || !double.IsFinite(high) || low >= high ||
                (id == "temperature" && low < -273.15) || (id == "humidity" && (low < 0 || high > 100)) || (id == "pressure" && low <= 0))
                yield return new ValidationResult("Ongeldige grenswaarden: ondergrens moet lager zijn dan bovengrens; vochtigheid 0–100%, druk groter dan 0, temperatuur vanaf −273,15°C.", [id + "Minimum", id + "Maximum"]);
        }
    }
}
