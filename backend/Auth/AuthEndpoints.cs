using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using SmartEnvironment.Api.Common;
using SmartEnvironment.Api.Data;

namespace SmartEnvironment.Api.Auth;

// All login endpoints as Minimal API. Program.cs only calls app.MapAuthEndpoints().
// Each endpoint is a small static method; ASP.NET Core fills its parameters
// from the request (JSON body, login cookie) or from the registered services.
public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        // Every route below starts with /api/auth.
        var group = app.MapGroup("/api/auth")
            .DisableCookieRedirect()          // Send 401 instead of redirecting to a login page.
            .AddEndpointFilter(ApiFilters.NoCacheFilter); // Browsers must not store login responses.

        group.MapGet("/csrf", GetCsrfToken)
            .AllowAnonymous();

        group.MapPost("/login", Login)
            .AllowAnonymous()
            .RequireRateLimiting("login")
            .AddEndpointFilter(ApiFilters.CsrfFilter);

        group.MapPost("/logout", Logout)
            .RequireAuthorization()
            .AddEndpointFilter(ApiFilters.CsrfFilter);

        group.MapGet("/me", GetCurrentUser)
            .RequireAuthorization();
    }

    // GET /api/auth/csrf
    // Creates a CSRF token, no login or request body is needed.
    // Returns 200 with { token } and sets the CSRF cookie if needed.
    // Send this token in the X-CSRF-TOKEN header for login/logout. Get a new token after login.
    private static IResult GetCsrfToken(HttpContext context, IAntiforgery antiforgery)
    {
        var tokens = antiforgery.GetAndStoreTokens(context);
        return Results.Ok(new { token = tokens.RequestToken });
    }

    // POST /api/auth/login
    // Expects JSON with email/password and a valid CSRF cookie and header.
    // Returns 200 with { id, email, fullName, role } and a login cookie, or 401 for invalid credentials.
    // Invalid input/CSRF returns 400, too many login requests return 429.
    private static async Task<IResult> Login(
        LoginRequest request,
        UserManager<AppUser> userManager,
        SignInManager<AppUser> signInManager)
    {
        // 1. Check the [Required], [EmailAddress] and [StringLength] rules in LoginRequest.
        var invalid = ApiFilters.Validate(request);
        if (invalid != null)
        {
            return invalid;
        }

        // 2. Find the account that belongs to the submitted email.
        AppUser? user = await userManager.FindByEmailAsync(request.Email.Trim());

        // An unknown email gets the same error as an incorrect password.
        if (user == null)
        {
            return Results.Unauthorized();
        }

        // 3. Check the password. On success, Identity creates the login cookie.
        // Do not remember the login after the browser session; count failed attempts.
        var loginResult = await signInManager.PasswordSignInAsync(
            user, request.Password, isPersistent: false, lockoutOnFailure: true);

        if (!loginResult.Succeeded)
        {
            return Results.Unauthorized();
        }

        // 4. Remember when this user last logged in (for "Laatst actief" on the Beheer page).
        user.LastLoginAt = DateTime.UtcNow;
        await userManager.UpdateAsync(user);

        // 5. Send the account details (including the role) back to React.
        return Results.Ok(await ToResponseAsync(user, userManager));
    }

    // POST /api/auth/logout
    // Expects a login cookie and valid CSRF token, no request body is needed.
    // Removes the login cookie and returns 204. Missing login returns 401; invalid CSRF returns 400.
    private static async Task<IResult> Logout(SignInManager<AppUser> signInManager)
    {
        await signInManager.SignOutAsync();
        return Results.NoContent();
    }

    // GET /api/auth/me
    // Expects a login cookie; no request body or CSRF token is needed.
    // Returns 200 with { id, email, fullName, role }, or 401 when the user is not logged in.
    private static async Task<IResult> GetCurrentUser(
        ClaimsPrincipal principal,
        UserManager<AppUser> userManager)
    {
        // principal contains the identity read from the login cookie.
        AppUser? currentUser = await userManager.GetUserAsync(principal);

        if (currentUser == null)
        {
            return Results.Unauthorized();
        }

        return Results.Ok(await ToResponseAsync(currentUser, userManager));
    }

    // ----- Helpers -----

    // The JSON React receives about a user. React uses role to show or hide the Beheer tab;
    // the backend still checks the role itself on every protected request.
    private static async Task<object> ToResponseAsync(AppUser user, UserManager<AppUser> userManager)
    {
        var roles = await userManager.GetRolesAsync(user);
        return new
        {
            id = user.Id,
            email = user.Email,
            fullName = user.FullName,
            role = roles.FirstOrDefault() ?? string.Empty
        };
    }
}