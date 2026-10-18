using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;

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
            .AddEndpointFilter(NoCacheFilter); // Browsers must not store login responses.

        group.MapGet("/csrf", GetCsrfToken)
            .AllowAnonymous();

        group.MapPost("/login", Login)
            .AllowAnonymous()
            .RequireRateLimiting("login")
            .AddEndpointFilter(CsrfFilter);

        group.MapPost("/logout", Logout)
            .RequireAuthorization()
            .AddEndpointFilter(CsrfFilter);

        group.MapGet("/me", GetCurrentUser)
            .RequireAuthorization();
    }

    // GET /api/auth/csrf
    // Creates a CSRF token, no login or request body is needed.
    // Returns 200 with { token } and sets the CSRF cookie if needed.
    private static IResult GetCsrfToken(HttpContext context, IAntiforgery antiforgery)
    {
        var tokens = antiforgery.GetAndStoreTokens(context);
        return Results.Ok(new { token = tokens.RequestToken });
    }

    // POST /api/auth/login
    // Expects JSON with email/password and a valid CSRF cookie and header.
    // Returns 200 with { id, email } and a login cookie, or 401 for invalid credentials.
    // Invalid input/CSRF returns 400, too many login requests return 429.
    private static async Task<IResult> Login(
        LoginRequest request,
        UserManager<IdentityUser> userManager,
        SignInManager<IdentityUser> signInManager)
    {
        // 1. Check the [Required], [EmailAddress] and [StringLength] rules in LoginRequest.
        if (!IsValid(request))
        {
            return Results.BadRequest(new { message = "Invalid email or password." });
        }

        // 2. Find the account that belongs to the submitted email.
        IdentityUser? user = await userManager.FindByEmailAsync(request.Email.Trim());

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

        // 4. Send the account details back to React.
        return Results.Ok(new { id = user.Id, email = user.Email });
    }

    // POST /api/auth/logout
    // Expects a login cookie and valid CSRF token. Removes the login cookie and returns 204.
    private static async Task<IResult> Logout(SignInManager<IdentityUser> signInManager)
    {
        await signInManager.SignOutAsync();
        return Results.NoContent();
    }

    // GET /api/auth/me
    // Expects a login cookie. Returns 200 with { id, email }, or 401 when not logged in.
    private static async Task<IResult> GetCurrentUser(
        ClaimsPrincipal principal,
        UserManager<IdentityUser> userManager)
    {
        // principal contains the identity read from the login cookie.
        IdentityUser? currentUser = await userManager.GetUserAsync(principal);

        if (currentUser == null)
        {
            return Results.Unauthorized();
        }

        return Results.Ok(new { id = currentUser.Id, email = currentUser.Email });
    }

    // ----- Helpers -----

    // Runs the validation attributes of a request class. Returns true when all rules pass.
    private static bool IsValid(object request)
    {
        var context = new ValidationContext(request);
        return Validator.TryValidateObject(request, context, null, validateAllProperties: true);
    }

    // Stops the request with 400 when the CSRF cookie and X-CSRF-TOKEN header do not match.
    // Used on every POST, because POST requests change something (log in or log out).
    private static async ValueTask<object?> CsrfFilter(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var antiforgery = context.HttpContext.RequestServices.GetRequiredService<IAntiforgery>();

        if (!await antiforgery.IsRequestValidAsync(context.HttpContext))
        {
            return Results.BadRequest(new { message = "Invalid CSRF token." });
        }

        return await next(context);
    }

    // Adds Cache-Control: no-store, so the browser never caches account data.
    private static async ValueTask<object?> NoCacheFilter(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        context.HttpContext.Response.Headers.CacheControl = "no-store";
        return await next(context);
    }
}