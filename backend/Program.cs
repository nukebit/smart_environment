using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartEnvironment.Api.Auth;
using SmartEnvironment.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// 1. Add API controllers and automatically check CSRF tokens on POST requests.
// WithViews is needed for the built-in CSRF filter; the pages are still React.
builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
});
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

// 6. Connect API URLs to controllers and page URLs to React.
app.MapControllers();
app.Map("/api/{**path}", () => Results.NotFound()).DisableCookieRedirect();
app.MapFallbackToFile("index.html").AllowAnonymous();

app.Run();
