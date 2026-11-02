using System.ComponentModel.DataAnnotations;

namespace SmartEnvironment.Api.Lokalen;

public class LokaalRequest
{
    [Required(ErrorMessage = "Vul een lokaalnaam in.")]
    [StringLength(100, ErrorMessage = "De lokaalnaam mag maximaal 100 tekens bevatten.")]
    public string Naam { get; set; } = string.Empty;

    [Required(ErrorMessage = "Selecteer een gebouw.")]
    [Range(1, int.MaxValue, ErrorMessage = "Selecteer een gebouw.")]
    public int? GebouwId { get; set; }
}
