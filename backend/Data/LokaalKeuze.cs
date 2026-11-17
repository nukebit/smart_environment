namespace SmartEnvironment.Api.Data;

// Iedere gebruiker heeft maximaal één persoonlijk actief lokaal.
public class LokaalKeuze
{
    public string UserId { get; set; } = string.Empty;
    public AppUser User { get; set; } = null!;
    public int LokaalId { get; set; }
    public Lokaal Lokaal { get; set; } = null!;
}
