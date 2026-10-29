using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace SmartEnvironment.Api.Data;

public static class AuthDatabase
{
    // Updates the database to the latest migration, adds example classrooms, creates the roles,
    // and, if configured, the first Beheerder account when no users exist.
    // Invalid account settings stop startup with an error.
    public static async Task InitializeAsync(IServiceProvider services, IConfiguration configuration)
    {
        // Create a scope so database services are disposed when initialization finishes.
        await using var scope = services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<AuthDbContext>();

        // Apply all migrations in the Migrations folder. New tables or columns are added
        // without deleting existing data.
        await database.Database.MigrateAsync();

        // Startgegevens toevoegen als er nog geen lokalen zijn.
        if (!await database.Lokalen.AnyAsync())
        {
            database.Lokalen.AddRange(
                new Lokaal { Naam = "1.02", Gebouw = "Voorbeeldgebouw" },
                new Lokaal { Naam = "2.14", Gebouw = "Voorbeeldgebouw" },
                new Lokaal { Naam = "3.05", Gebouw = "Voorbeeldgebouw" });
            await database.SaveChangesAsync();
        }

        // 1. Make sure the roles Beheerder and Docent exist.
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in Roles.All)
        {
            if (!await roles.RoleExistsAsync(role))
            {
                await roles.CreateAsync(new IdentityRole(role));
            }
        }

        // 2. Only create the first account when the database has no users yet.
        if (await database.Users.AnyAsync())
        {
            return;
        }

        // Read first account credentials from configuration, usually local user secrets.
        var email = configuration["Auth:InitialUser:Email"];
        var password = configuration["Auth:InitialUser:Password"];

        if (string.IsNullOrWhiteSpace(email) && string.IsNullOrWhiteSpace(password))
        {
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<AuthDbContext>>();
            logger.LogWarning("No accounts exist. Set Auth:InitialUser:Email and Auth:InitialUser:Password to create the first account.");
            return;
        }

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password)
            || email.Trim().Length > 254 || password.Length > 512)
        {
            throw new InvalidOperationException("Configure both a valid initial email and password using local secrets.");
        }

        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var user = new AppUser
        {
            UserName = email.Trim(),
            Email = email.Trim(),
            FullName = "Beheerder"
        };

        // Identity validates the account and stores a password hash.
        var result = await users.CreateAsync(user, password);

        if (!result.Succeeded)
        {
            var errors = string.Join(" ", result.Errors.Select(error => error.Description));
            throw new InvalidOperationException("The initial account could not be created: " + errors);
        }

        // The first account is the Beheerder, so it can create the Docent accounts.
        await users.AddToRoleAsync(user, Roles.Beheerder);
    }
}
