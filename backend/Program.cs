using Microsoft.EntityFrameworkCore;
using SmartEnvironment.Api.Auth;
using SmartEnvironment.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// 1. Send errors as standard JSON (ProblemDetails) instead of an HTML error page.
builder.Services.AddProblemDetails();

// 2. Connect to the database specified in appsettings.json.
string? connectionString = builder.Configuration.GetConnectionString("Auth");
builder.Services.AddDbContext<AuthDbContext>(options => options.UseSqlite(connectionString));

// 3. Add the login system. Its settings are grouped in AuthSetup.cs.
AuthSetup.Configure(builder);

var app = builder.Build();

// 4. Create the database and first account if needed.
await AuthDatabase.InitializeAsync(app.Services, app.Configuration);

// 5. Set up how incoming requests are handled.
app.UseExceptionHandler();
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseDefaultFiles();          // Use index.html as the default page.
app.UseStaticFiles();           // Serve the React JavaScript and CSS.
app.UseRouting();               // Find the endpoint for this request.
app.UseAuthentication();        // Read the login cookie to identify the user.
app.UseAuthorization();         // Check whether the user can access the endpoint.
app.UseRateLimiter();           // Check the limit on login attempts.

// 6. Connect API URLs to Minimal API endpoints and page URLs to React.
app.MapAuthEndpoints();         // /api/auth/... (see Auth/AuthEndpoints.cs)
app.Map("/api/{**path}", () => Results.NotFound()).DisableCookieRedirect();
app.MapFallbackToFile("index.html").AllowAnonymous();

app.Run();