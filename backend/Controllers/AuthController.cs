using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SmartEnvironment.Api.Auth;

namespace SmartEnvironment.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/auth")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AuthController : ControllerBase
{
    private readonly SignInManager<IdentityUser> _signInManager;
    private readonly UserManager<IdentityUser> _userManager;
    private readonly IAntiforgery _antiforgery;

    // ASP.NET Core provides these services when it creates the controller.
    public AuthController(
        SignInManager<IdentityUser> signInManager,
        UserManager<IdentityUser> userManager,
        IAntiforgery antiforgery)
    {
        _signInManager = signInManager;
        _userManager = userManager;
        _antiforgery = antiforgery;
    }

    // Creates a CSRF token, no login or request body is needed.
    // Returns 200 with { token } and sets the CSRF cookie if needed.
    // Send this token in the X-CSRF-TOKEN header for login/logout. Get a new token after login.
    [AllowAnonymous]
    [HttpGet("csrf")]
    public IActionResult GetCsrfToken()
    {
        var tokens = _antiforgery.GetAndStoreTokens(HttpContext);
        return Ok(new { token = tokens.RequestToken });
    }

    // Expects JSON with email/password and a valid CSRF cookie and header.
    // Returns 200 with { id, email } and a login cookie, or 401 for invalid credentials.
    // Invalid input/CSRF returns 400, too many login requests return 429.
    [AllowAnonymous]
    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        // 1. Find the account that belongs to the submitted email.
        string email = request.Email.Trim();
        IdentityUser? user = await _userManager.FindByEmailAsync(email);

        // An unknown email gets the same error as an incorrect password.
        if (user == null)
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        // 2. Check the password. On success, Identity creates the login cookie.
        // Do not remember the login after the browser session; count failed attempts.
        var loginResult = await _signInManager.PasswordSignInAsync(
            user, request.Password, isPersistent: false, lockoutOnFailure: true);

        if (!loginResult.Succeeded)
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        // 3. Send the account details back to React.
        return Ok(new { id = user.Id, email = user.Email });
    }

    // Expects a login cookie and valid CSRF token, no request body is needed.
    // Removes the login cookie and returns 204. Missing login returns 401; invalid CSRF returns 400.
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return NoContent();
    }

    // Expects a login cookie; no request body or CSRF token is needed.
    // Returns 200 with { id, email }, or 401 when the user is not logged in.
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        // User contains the identity read from the login cookie.
        IdentityUser? currentUser = await _userManager.GetUserAsync(User);

        if (currentUser == null)
        {
            return Unauthorized();
        }

        return Ok(new { id = currentUser.Id, email = currentUser.Email });
    }
}
