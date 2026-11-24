using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SmartEnvironment.Api.Data;

namespace SmartEnvironment.Api.Tests;

// Start de echte backend (Program.cs) in het geheugen, met een EIGEN test-database.
// Je eigen auth.db wordt dus nooit aangeraakt.
// Elke testklasse met IClassFixture<TestApp> krijgt een eigen backend en een eigen database.
public class TestApp : IAsyncLifetime
{
    // Vaste testaccounts. Het wachtwoord voldoet aan de Development-regels (minimaal 8 tekens).
    public const string BeheerderEmail = "beheerder@test.nl";
    public const string DocentEmail = "docent@test.nl";
    public const string Wachtwoord = "Wachtwoord123";

    private readonly string databasePath =
        Path.Combine(Path.GetTempPath(), $"smartenvironment-test-{Guid.NewGuid()}.db");

    private readonly TestFactory factory;

    public TestApp()
    {
        factory = new TestFactory($"Data Source={databasePath}");
    }

    // Al ingelogde clients die alle tests van een klasse delen.
    // Zo loggen we niet in elke test opnieuw in (de backend staat maar 20 logins per minuut toe).
    public HttpClient BeheerderClient { get; private set; } = null!;
    public HttpClient DocentClient { get; private set; } = null!;

    // Draait één keer vóór de tests van een klasse.
    public async Task InitializeAsync()
    {
        // De backend start hier en maakt zelf de rollen en het Beheerder-account aan
        // (AuthDatabase.cs). Wij voegen er alleen een Docent-account aan toe.
        await CreateUserAsync(DocentEmail, Roles.Docent);

        BeheerderClient = await CreateLoggedInClientAsync(BeheerderEmail);
        DocentClient = await CreateLoggedInClientAsync(DocentEmail);
    }

    // Draait één keer na de tests van een klasse: backend stoppen en test-database weggooien.
    public async Task DisposeAsync()
    {
        await factory.DisposeAsync();
        SqliteConnection.ClearAllPools();

        try
        {
            File.Delete(databasePath);
        }
        catch (IOException)
        {
            // Bestand nog in gebruik: geen probleem, het staat in de tijdelijke map.
        }
    }

    // Maakt een account met een rol direct in de test-database.
    public async Task CreateUserAsync(string email, string role)
    {
        using var scope = factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        var user = new AppUser { UserName = email, Email = email, FullName = "Test " + role };
        var result = await users.CreateAsync(user, Wachtwoord);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException("Testaccount maken mislukt: "
                + string.Join(" ", result.Errors.Select(error => error.Description)));
        }

        await users.AddToRoleAsync(user, role);
    }

    // Een HttpClient die cookies onthoudt, net als een browser (login-cookie en CSRF-cookie).
    public HttpClient CreateClient()
    {
        return factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
    }

    // Een client die al is ingelogd. Stopt de test meteen als inloggen mislukt.
    public async Task<HttpClient> CreateLoggedInClientAsync(string email)
    {
        var client = CreateClient();
        var response = await LoginAsync(client, email, Wachtwoord);

        if (response.StatusCode != HttpStatusCode.OK)
        {
            throw new InvalidOperationException($"Inloggen als {email} gaf {(int)response.StatusCode}.");
        }

        return client;
    }

    // ----- Hulpmethodes die doen wat de React-frontend ook doet -----

    // GET /api/auth/csrf en geef de token terug.
    public static async Task<string> GetCsrfTokenAsync(HttpClient client)
    {
        var response = await client.GetFromJsonAsync<CsrfResponse>("/api/auth/csrf");
        return response!.Token;
    }

    // Eerst een CSRF-token halen, dan POST /api/auth/login.
    public static async Task<HttpResponseMessage> LoginAsync(HttpClient client, string email, string password)
    {
        return await SendAsync(client, HttpMethod.Post, "/api/auth/login", new { email, password });
    }

    // Een POST, PUT of DELETE met een verse CSRF-token in de header X-CSRF-TOKEN.
    // Na het inloggen is een nieuwe token nodig, daarom halen we hem elke keer opnieuw op.
    public static async Task<HttpResponseMessage> SendAsync(
        HttpClient client, HttpMethod method, string url, object? body = null)
    {
        var token = await GetCsrfTokenAsync(client);

        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-CSRF-TOKEN", token);
        if (body != null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request);
    }

    private record CsrfResponse(string Token);

    // Zet de backend in testmodus: eigen database en vaste instellingen.
    private sealed class TestFactory(string connectionString) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");

            // Het eerste Beheerder-account voor de tests (vervangt je eigen user-secrets).
            builder.ConfigureAppConfiguration((_, config) =>
            {
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Auth:InitialUser:Email"] = BeheerderEmail,
                    ["Auth:InitialUser:Password"] = Wachtwoord
                });
            });

            // Gebruik de test-database in plaats van auth.db.
            builder.ConfigureTestServices(services =>
            {
                services.ConfigureDbContext<AuthDbContext>(options => options.UseSqlite(connectionString));
            });
        }
    }
}