using System.ComponentModel.DataAnnotations;

namespace SmartEnvironment.Api.Lokalen;

public class ActiefLokaalRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Selecteer een bestaand lokaal.")]
    public int LokaalId { get; set; }
}
