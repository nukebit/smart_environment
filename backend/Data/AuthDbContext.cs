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
}