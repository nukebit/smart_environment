using System.Net;
using SmartEnvironment.Api.Data;

namespace SmartEnvironment.Api.Tests.Integration;

// SECURITY TEST: na 5 foute wachtwoorden wordt een account 5 minuten geblokkeerd (AuthSetup.cs).
// Zo kan niemand eindeloos wachtwoorden proberen.
public class LockoutTests(TestApp app) : IClassFixture<TestApp>
{
    [Fact]
    public async Task Login_VijfKeerFoutWachtwoord_DaarnaOokJuistWachtwoordGeweigerd()
    {
        // Arrange: een eigen account, zodat de gedeelde testaccounts niet geblokkeerd raken
        var email = $"lockout-{Guid.NewGuid():N}@test.nl";
        await app.CreateUserAsync(email, Roles.Docent);
        var client = app.CreateClient();

        for (int poging = 1; poging <= 5; poging++)
        {
            await TestApp.LoginAsync(client, email, "FoutWachtwoord");
        }

        // Act: nu met het JUISTE wachtwoord
        var response = await TestApp.LoginAsync(client, email, TestApp.Wachtwoord);

        // Assert: toch geweigerd, want het account is geblokkeerd
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}