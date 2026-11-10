using System.ComponentModel.DataAnnotations;

namespace SmartEnvironment.Api.Gebouwen;

public class GebouwRequest
{
    [Required(ErrorMessage = "Vul een gebouwnaam in.")]
    [StringLength(100, ErrorMessage = "De gebouwnaam mag maximaal 100 tekens bevatten.")]
    public string Naam { get; set; } = string.Empty;
}
