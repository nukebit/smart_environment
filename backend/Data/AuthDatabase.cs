using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace SmartEnvironment.Api.Data;

public static class AuthDatabase
{
    // Creates the database and, if configured, the first account when no users exist.
    // Expects registered database/Identity services and optional initial user settings.
    // Returns a Task with no value. Invalid account settings stop startup with an error.
    public static async Task InitializeAsync(IServiceProvider services, IConfiguration configuration)
    {
        // Create a scope so database services are disposed when initialization finishes.
        await using var scope = services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<AuthDbContext>();

        // Create missing tables. This does not migrate an existing database schema.
        await database.Database.EnsureCreatedAsync();

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

        var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
        var user = new IdentityUser
        {
            UserName = email.Trim(),
            Email = email.Trim()
        };

        // Identity validates the account and stores a password hash.
        var result = await users.CreateAsync(user, password);

        if (!result.Succeeded)
        {
            var errors = string.Join(" ", result.Errors.Select(error => error.Description));
            throw new InvalidOperationException("The initial account could not be created: " + errors);
        }
    }
}
