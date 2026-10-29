using System.ComponentModel.DataAnnotations;

namespace SmartEnvironment.Api.Lokalen;

public class LokaalRequest
{
    [Required(ErrorMessage = "Vul een lokaalnaam in.")]
    [StringLength(100, ErrorMessage = "De lokaalnaam mag maximaal 100 tekens bevatten.")]
    public string Naam { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vul een gebouw in.")]
    [StringLength(100, ErrorMessage = "Het gebouw mag maximaal 100 tekens bevatten.")]
    public string Gebouw { get; set; } = string.Empty;
}
