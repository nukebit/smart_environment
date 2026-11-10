using System.Net;
using System.Net.Http.Json;
using SmartEnvironment.Api.Data;

namespace SmartEnvironment.Api.Tests.Integration;

// HTTP-INTEGRATIETESTEN voor Auth/AuthEndpoints.cs.
// Elke test stuurt echte HTTP-verzoeken naar de backend, net als de React-frontend.
// Zo testen we alles samen: endpoint + Identity + cookies + CSRF + database.
public class AuthEndpointsTests(TestApp app) : IClassFixture<TestApp>
{
    // Zo ziet het antwoord van /login en /me eruit.
    private record MeResponse(string Id, string Email, string FullName, string Role);

    [Fact]
    public async Task Csrf_ZonderLogin_Geeft200()
    {
        // Arrange
        var client = app.CreateClient();

        // Act
        var response = await client.GetAsync("/api/auth/csrf");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Login_JuistWachtwoord_Geeft200()
    {
        // Arrange
        var client = app.CreateClient();

        // Act
        var response = await TestApp.LoginAsync(client, TestApp.BeheerderEmail, TestApp.Wachtwoord);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Login_AlsBeheerder_GeeftRolBeheerderTerug()
    {
        // Arrange
        var client = app.CreateClient();

        // Act
        var response = await TestApp.LoginAsync(client, TestApp.BeheerderEmail, TestApp.Wachtwoord);

        // Assert
        var user = await response.Content.ReadFromJsonAsync<MeResponse>();
        Assert.Equal(Roles.Beheerder, user!.Role);
    }

    [Fact]
    public async Task Login_FoutWachtwoord_Geeft401()
    {
        // Arrange
        var client = app.CreateClient();

        // Act
        var response = await TestApp.LoginAsync(client, TestApp.DocentEmail, "FoutWachtwoord");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_OnbekendEmail_Geeft401()
    {
        // Arrange
        var client = app.CreateClient();

        // Act
        var response = await TestApp.LoginAsync(client, "bestaatniet@test.nl", TestApp.Wachtwoord);

        // Assert: dezelfde fout als een fout wachtwoord, zodat niemand kan raden welke e-mails bestaan
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_OngeldigEmailFormaat_Geeft400()
    {
        // Arrange
        var client = app.CreateClient();

        // Act
        var response = await TestApp.LoginAsync(client, "geen-emailadres", TestApp.Wachtwoord);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Login_ZonderCsrfToken_Geeft400()
    {
        // Arrange: een login ZONDER de header X-CSRF-TOKEN
        var client = app.CreateClient();
        var body = new { email = TestApp.BeheerderEmail, password = TestApp.Wachtwoord };

        // Act
        var response = await client.PostAsJsonAsync("/api/auth/login", body);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Me_NietIngelogd_Geeft401()
    {
        // Arrange
        var client = app.CreateClient();

        // Act
        var response = await client.GetAsync("/api/auth/me");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_IngelogdAlsDocent_GeeftEigenGegevens()
    {
        // Arrange
        var client = app.DocentClient;

        // Act
        var user = await client.GetFromJsonAsync<MeResponse>("/api/auth/me");

        // Assert
        Assert.Equal(TestApp.DocentEmail, user!.Email);
        Assert.Equal(Roles.Docent, user.Role);
    }

    [Fact]
    public async Task Me_Antwoord_WordtNietOpgeslagenDoorBrowser()
    {
        // Arrange
        var client = app.DocentClient;

        // Act
        var response = await client.GetAsync("/api/auth/me");

        // Assert: Cache-Control: no-store (NoCacheFilter)
        Assert.True(response.Headers.CacheControl?.NoStore);
    }

    [Fact]
    public async Task Logout_NaInloggen_MeGeeftDaarna401()
    {
        // Arrange: een EIGEN client, zodat de gedeelde DocentClient ingelogd blijft
        var client = await app.CreateLoggedInClientAsync(TestApp.DocentEmail);

        // Act
        await TestApp.SendAsync(client, HttpMethod.Post, "/api/auth/logout");

        // Assert: de login-cookie is weg, dus /me werkt niet meer
        var response = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}