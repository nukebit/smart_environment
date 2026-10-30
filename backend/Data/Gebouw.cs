using System.ComponentModel.DataAnnotations;

namespace SmartEnvironment.Api.Data;

public class Gebouw
{
    public int Id { get; set; }

    [MaxLength(100)]
    public string Naam { get; set; } = string.Empty;
}
