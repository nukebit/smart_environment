using System.Net;
using System.Net.Http.Json;
using SmartEnvironment.Api.Data;
using SmartEnvironment.Api.Users;

namespace SmartEnvironment.Api.Tests.Integration;

// HTTP-INTEGRATIETESTEN voor Users/UserEndpoints.cs (CRUD voor de Beheerder).
// We testen het rolbeleid (RBAC): niet ingelogd = 401, Docent = 403, Beheerder = toegestaan.
// Elke test maakt zijn eigen account met een uniek e-mailadres, zodat tests elkaar niet beïnvloeden.
public class UserEndpointsTests(TestApp app) : IClassFixture<TestApp>
{
    // ----- Toegang (autorisatie) -----

    [Fact]
    public async Task GetUsers_NietIngelogd_Geeft401()
    {
        // Arrange
        var client = app.CreateClient();

        // Act
        var response = await client.GetAsync("/api/users");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetUsers_AlsDocent_Geeft403()
    {
        // Arrange
        var client = app.DocentClient;

        // Act
        var response = await client.GetAsync("/api/users");

        // Assert: ingelogd, maar niet de juiste rol
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CreateUser_AlsDocent_Geeft403()
    {
        // Arrange
        var client = app.DocentClient;

        // Act
        var response = await TestApp.SendAsync(client, HttpMethod.Post, "/api/users", NieuweDocent());

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetUsers_AlsBeheerder_GeeftLijstMetTestaccounts()
    {
        // Arrange
        var client = app.BeheerderClient;

        // Act
        var users = await client.GetFromJsonAsync<List<UserResponse>>("/api/users");

        // Assert
        Assert.Contains(users!, user => user.Email == TestApp.DocentEmail);
    }

    [Fact]
    public async Task GetUsers_AlsBeheerder_StuurtGeenWachtwoordHashMee()
    {
        // Arrange
        var client = app.BeheerderClient;

        // Act
        var json = await client.GetStringAsync("/api/users");

        // Assert
        Assert.DoesNotContain("passwordHash", json, StringComparison.OrdinalIgnoreCase);
    }

    // ----- CREATE -----

    [Fact]
    public async Task CreateUser_AlsBeheerder_Geeft201()
    {
        // Arrange
        var client = app.BeheerderClient;

        // Act
        var response = await TestApp.SendAsync(client, HttpMethod.Post, "/api/users", NieuweDocent());

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task CreateUser_NieuweDocent_KanDaarnaInloggen()
    {
        // Arrange
        var admin = app.BeheerderClient;
        var docent = NieuweDocent();
        await TestApp.SendAsync(admin, HttpMethod.Post, "/api/users", docent);

        // Act
        var response = await TestApp.LoginAsync(app.CreateClient(), docent.Email, docent.Password);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task CreateUser_EmailBestaatAl_Geeft400()
    {
        // Arrange
        var client = app.BeheerderClient;
        var dubbel = NieuweDocent(email: TestApp.DocentEmail);

        // Act
        var response = await TestApp.SendAsync(client, HttpMethod.Post, "/api/users", dubbel);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateUser_OnbekendeRol_Geeft400()
    {
        // Arrange
        var client = app.BeheerderClient;
        var verkeerd = NieuweDocent(role: "Admin");

        // Act
        var response = await TestApp.SendAsync(client, HttpMethod.Post, "/api/users", verkeerd);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateUser_ZonderCsrfToken_Geeft400()
    {
        // Arrange: POST zonder de header X-CSRF-TOKEN
        var client = app.BeheerderClient;

        // Act
        var response = await client.PostAsJsonAsync("/api/users", NieuweDocent());

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ----- UPDATE -----

    [Fact]
    public async Task UpdateUser_AlsBeheerder_WijzigtNaamEnRol()
    {
        // Arrange
        var client = app.BeheerderClient;
        var id = await MaakDocentAsync(client);
        var wijziging = new { fullName = "Nieuwe Naam", email = UniekEmail(), role = Roles.Beheerder };

        // Act
        var response = await TestApp.SendAsync(client, HttpMethod.Put, $"/api/users/{id}", wijziging);

        // Assert
        var user = await response.Content.ReadFromJsonAsync<UserResponse>();
        Assert.Equal("Nieuwe Naam", user!.FullName);
        Assert.Equal(Roles.Beheerder, user.Role);
    }

    [Fact]
    public async Task UpdateUser_EigenRolNaarDocent_Geeft400()
    {
        // Arrange: de beheerder zoekt zijn eigen id op
        var client = app.BeheerderClient;
        var users = await client.GetFromJsonAsync<List<UserResponse>>("/api/users");
        var eigenId = users!.Single(user => user.Email == TestApp.BeheerderEmail).Id;
        var wijziging = new { fullName = "Beheerder", email = TestApp.BeheerderEmail, role = Roles.Docent };

        // Act
        var response = await TestApp.SendAsync(client, HttpMethod.Put, $"/api/users/{eigenId}", wijziging);

        // Assert: anders kan niemand meer accounts beheren
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateUser_OnbekendId_Geeft404()
    {
        // Arrange
        var client = app.BeheerderClient;
        var wijziging = new { fullName = "Iemand", email = UniekEmail(), role = Roles.Docent };

        // Act
        var response = await TestApp.SendAsync(client, HttpMethod.Put, "/api/users/bestaat-niet", wijziging);

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ----- DELETE -----

    [Fact]
    public async Task DeleteUser_AlsBeheerder_Geeft204()
    {
        // Arrange
        var client = app.BeheerderClient;
        var id = await MaakDocentAsync(client);

        // Act
        var response = await TestApp.SendAsync(client, HttpMethod.Delete, $"/api/users/{id}");

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteUser_EigenAccount_Geeft400()
    {
        // Arrange
        var client = app.BeheerderClient;
        var users = await client.GetFromJsonAsync<List<UserResponse>>("/api/users");
        var eigenId = users!.Single(user => user.Email == TestApp.BeheerderEmail).Id;

        // Act
        var response = await TestApp.SendAsync(client, HttpMethod.Delete, $"/api/users/{eigenId}");

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteUser_OnbekendId_Geeft404()
    {
        // Arrange
        var client = app.BeheerderClient;

        // Act
        var response = await TestApp.SendAsync(client, HttpMethod.Delete, "/api/users/bestaat-niet");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ----- Hulpmethodes -----

    private record NieuwAccount(string FullName, string Email, string Role, string Password);

    private static string UniekEmail()
    {
        return $"docent-{Guid.NewGuid():N}@test.nl";
    }

    private static NieuwAccount NieuweDocent(string? email = null, string role = Roles.Docent)
    {
        return new NieuwAccount("Test Docent", email ?? UniekEmail(), role, TestApp.Wachtwoord);
    }

    // Maakt via de API een nieuwe docent aan en geeft het id terug.
    private static async Task<string> MaakDocentAsync(HttpClient client)
    {
        var response = await TestApp.SendAsync(client, HttpMethod.Post, "/api/users", NieuweDocent());
        var user = await response.Content.ReadFromJsonAsync<UserResponse>();
        return user!.Id;
    }
}