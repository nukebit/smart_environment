using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SmartEnvironment.Api.Auth;
using SmartEnvironment.Api.Data;

namespace SmartEnvironment.Api.Users;

// Account management (CRUD) as Minimal API. Program.cs calls app.MapUserEndpoints().
// Only a logged-in Beheerder may use these endpoints:
// not logged in = 401, logged in as Docent = 403. The backend checks this on EVERY request,
// also when someone calls the API directly without the React page.
public static class UserEndpoints
{
    public static void MapUserEndpoints(this WebApplication app)
    {
        // Every route below starts with /api/users and requires the Beheerder role.
        var group = app.MapGroup("/api/users")
            .RequireAuthorization(policy => policy.RequireRole(Roles.Beheerder))
            .DisableCookieRedirect()                      // Send 401/403 instead of redirecting.
            .AddEndpointFilter(ApiFilters.NoCacheFilter);

        group.MapGet("", GetAll);                                               // READ
        group.MapPost("", Create).AddEndpointFilter(ApiFilters.CsrfFilter);     // CREATE
        group.MapPut("/{id}", Update).AddEndpointFilter(ApiFilters.CsrfFilter); // UPDATE
        group.MapDelete("/{id}", Delete).AddEndpointFilter(ApiFilters.CsrfFilter); // DELETE
    }

    // READ: GET /api/users
    // Returns 200 with all accounts for the table on the Beheer page.
    private static async Task<IResult> GetAll(UserManager<AppUser> userManager)
    {
        var users = await userManager.Users.OrderBy(user => user.FullName).ToListAsync();

        var result = new List<UserResponse>();
        foreach (var user in users)
        {
            result.Add(await ToResponseAsync(user, userManager));
        }

        return Results.Ok(result);
    }

    // CREATE: POST /api/users
    // Expects { fullName, email, role, password } and a CSRF token.
    // Returns 201 with the new account, or 400 when the input is invalid
    // (for example: email already in use, password too short, unknown role).
    private static async Task<IResult> Create(
        CreateUserRequest request,
        UserManager<AppUser> userManager)
    {
        var invalid = ApiFilters.Validate(request);
        if (invalid != null)
        {
            return invalid;
        }

        if (!Roles.All.Contains(request.Role))
        {
            return ApiFilters.FieldError("Role", "Kies Docent of Beheerder.");
        }

        var email = request.Email.Trim();
        var user = new AppUser
        {
            UserName = email,
            Email = email,
            FullName = request.FullName.Trim()
        };

        // Identity checks the password rules and unique email, then stores a password hash.
        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return ApiFilters.IdentityErrors(result);
        }

        await userManager.AddToRoleAsync(user, request.Role);

        return Results.Created($"/api/users/{user.Id}", await ToResponseAsync(user, userManager));
    }

    // UPDATE: PUT /api/users/{id}
    // Expects { fullName, email, role } and a CSRF token. The password is not changed here.
    // Returns 200 with the changed account, 404 when the id does not exist, or 400 for invalid input.
    private static async Task<IResult> Update(
        string id,
        UpdateUserRequest request,
        ClaimsPrincipal principal,
        UserManager<AppUser> userManager)
    {
        var invalid = ApiFilters.Validate(request);
        if (invalid != null)
        {
            return invalid;
        }

        if (!Roles.All.Contains(request.Role))
        {
            return ApiFilters.FieldError("Role", "Kies Docent of Beheerder.");
        }

        var user = await userManager.FindByIdAsync(id);
        if (user == null)
        {
            return Results.NotFound();
        }

        // A Beheerder cannot remove their own Beheerder role, otherwise nobody can manage accounts.
        bool isCurrentUser = userManager.GetUserId(principal) == user.Id;
        if (isCurrentUser && request.Role != Roles.Beheerder)
        {
            return ApiFilters.FieldError("Role", "Je kunt je eigen beheerdersrol niet weghalen.");
        }

        var email = request.Email.Trim();
        user.FullName = request.FullName.Trim();
        user.Email = email;
        user.UserName = email;

        // UpdateAsync also checks that the new email is not used by another account.
        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            return ApiFilters.IdentityErrors(result);
        }

        // Replace the old role with the new one.
        var currentRoles = await userManager.GetRolesAsync(user);
        if (!currentRoles.Contains(request.Role))
        {
            await userManager.RemoveFromRolesAsync(user, currentRoles);
            await userManager.AddToRoleAsync(user, request.Role);
        }

        return Results.Ok(await ToResponseAsync(user, userManager));
    }

    // DELETE: DELETE /api/users/{id}
    // Expects a CSRF token. Returns 204 when deleted, 404 when the id does not exist,
    // or 400 when a Beheerder tries to delete their own account.
    private static async Task<IResult> Delete(
        string id,
        ClaimsPrincipal principal,
        UserManager<AppUser> userManager)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user == null)
        {
            return Results.NotFound();
        }

        if (userManager.GetUserId(principal) == user.Id)
        {
            return ApiFilters.FieldError("Id", "Je kunt je eigen account niet verwijderen.");
        }

        var result = await userManager.DeleteAsync(user);
        if (!result.Succeeded)
        {
            return ApiFilters.IdentityErrors(result);
        }

        return Results.NoContent();
    }

    // Turns an AppUser into the JSON the frontend receives. The password hash is never sent.
    private static async Task<UserResponse> ToResponseAsync(AppUser user, UserManager<AppUser> userManager)
    {
        var roles = await userManager.GetRolesAsync(user);
        return new UserResponse(
            user.Id,
            user.FullName,
            user.Email ?? string.Empty,
            roles.FirstOrDefault() ?? string.Empty,
            user.LastLoginAt);
    }
}