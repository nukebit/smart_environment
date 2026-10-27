using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace SmartEnvironment.Api.Data;

// Gives Identity access to the user AND role tables in SQLite.
// IdentityDbContext (instead of IdentityUserContext) adds AspNetRoles and AspNetUserRoles.
public class AuthDbContext : IdentityDbContext<AppUser>
{
    // Receives the database settings from Program.cs and passes them to Identity.
    public AuthDbContext(DbContextOptions<AuthDbContext> options) : base(options)
    {
    }

    public DbSet<Lokaal> Lokalen => Set<Lokaal>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        var lokaal = builder.Entity<Lokaal>();
        lokaal.Property(item => item.Naam).UseCollation("NOCASE");
        lokaal.Property(item => item.Gebouw).UseCollation("NOCASE");
        // Een lokaalnaam mag maar een keer voorkomen binnen hetzelfde gebouw.
        lokaal.HasIndex(item => new { item.Gebouw, item.Naam }).IsUnique();
    }
}
