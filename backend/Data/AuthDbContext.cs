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
    public DbSet<Gebouw> Gebouwen => Set<Gebouw>();
    public DbSet<LokaalKeuze> LokaalKeuzes => Set<LokaalKeuze>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        var gebouw = builder.Entity<Gebouw>();
        gebouw.Property(item => item.Naam).UseCollation("NOCASE");
        gebouw.HasIndex(item => item.Naam).IsUnique();

        var lokaal = builder.Entity<Lokaal>();
        lokaal.Property(item => item.Naam).UseCollation("NOCASE");
        lokaal.HasOne(item => item.Gebouw).WithMany()
            .HasForeignKey(item => item.GebouwId).OnDelete(DeleteBehavior.Restrict);
        // Een lokaalnaam mag maar een keer voorkomen binnen hetzelfde gebouw.
        lokaal.HasIndex(item => new { item.GebouwId, item.Naam }).IsUnique();

        var keuze = builder.Entity<LokaalKeuze>();
        keuze.HasKey(item => item.UserId);
        keuze.HasOne(item => item.User).WithMany()
            .HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Cascade);
        keuze.HasOne(item => item.Lokaal).WithMany()
            .HasForeignKey(item => item.LokaalId).OnDelete(DeleteBehavior.Cascade);
    }
}
