using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using SmartEnvironment.Api.Data;

namespace SmartEnvironment.Api.Auth;

// Login settings are kept here so Program.cs can focus on starting the server.
// Each method receives the application builder, registers settings, and returns no value.
public static class AuthSetup
{
    // Adds the services needed for login, cookies, access checks, and login limits.
    public static void Configure(WebApplicationBuilder builder)
    {
        ConfigureAccounts(builder);
        ConfigureCookiesAndCsrf(builder);
        ConfigureAccess(builder);
        ConfigureLoginLimit(builder);
    }

    // Identity saves users in SQLite and handles password hashing and account lockout.
    private static void ConfigureAccounts(WebApplicationBuilder builder)
    {
        var identity = builder.Services.AddIdentityCore<IdentityUser>(options =>
        {
            options.User.RequireUniqueEmail = true;
            options.Password.RequiredLength = 12;

            // Allow our simple test password during local development.
            if (builder.Environment.IsDevelopment())
            {
                options.Password.RequiredLength = 8;
                options.Password.RequireUppercase = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireDigit = false;
                options.Password.RequireNonAlphanumeric = false;
            }

            // Five failed attempts lock the account for five minutes.
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
        });

        identity.AddEntityFrameworkStores<AuthDbContext>();
        identity.AddSignInManager();
    }

    // The login cookie identifies the user. The CSRF token protects requests that change data.
    private static void ConfigureCookiesAndCsrf(WebApplicationBuilder builder)
    {
        builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme)
            .AddIdentityCookies();

        // Require HTTPS for cookies, except when developing locally over HTTP.
        var cookieSecurity = CookieSecurePolicy.Always;
        if (builder.Environment.IsDevelopment())
        {
            cookieSecurity = CookieSecurePolicy.SameAsRequest;
        }

        builder.Services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = "SmartEnvironment.Auth";
            options.Cookie.HttpOnly = true;                  // JavaScript cannot read this cookie.
            options.Cookie.SameSite = SameSiteMode.Strict;   // Limit cross site cookie requests.
            options.Cookie.SecurePolicy = cookieSecurity;
            options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
            options.SlidingExpiration = false;               // Activity does not extend the login.
        });

        builder.Services.AddAntiforgery(options =>
        {
            options.HeaderName = "X-CSRF-TOKEN";
            options.Cookie.Name = "SmartEnvironment.Csrf";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.Cookie.SecurePolicy = cookieSecurity;
        });
    }

    // Endpoints require login unless they have the AllowAnonymous attribute.
    private static void ConfigureAccess(WebApplicationBuilder builder)
    {
        builder.Services.AddAuthorization(options =>
        {
            options.FallbackPolicy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build();
        });
    }

    // Allow 20 login requests per IP address per minute, extra requests receive 429.
    private static void ConfigureLoginLimit(WebApplicationBuilder builder)
    {
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy("login", context =>
            {
                var ipAddress = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

                return RateLimitPartition.GetFixedWindowLimiter(ipAddress, _ =>
                    new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 20,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0
                    });
            });
        });
    }
}
