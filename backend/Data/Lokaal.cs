using System.ComponentModel.DataAnnotations;

namespace SmartEnvironment.Api.Data;

public class Lokaal
{
    public int Id { get; set; }

    [MaxLength(100)]
    public string Naam { get; set; } = string.Empty;

    public int GebouwId { get; set; }

    public Gebouw Gebouw { get; set; } = null!;
}
