using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace SmartEnvironment.Api.Data;

// Gives Identity access to the user tables in SQLite.
public class AuthDbContext : IdentityUserContext<IdentityUser>
{
    // Receives the database settings from Program.cs and passes them to Identity.
    public AuthDbContext(DbContextOptions<AuthDbContext> options) : base(options)
    {
    }
}
