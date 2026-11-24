using System.Net;

namespace SmartEnvironment.Api.Tests.Integration;

// SECURITY TEST: de backend staat maximaal 20 login-verzoeken per minuut toe (AuthSetup.cs).
// Deze test staat in een eigen klasse, zodat hij een eigen backend heeft
// en andere tests niet per ongeluk een 429 krijgen.
public class RateLimitTests(TestApp app) : IClassFixture<TestApp>
{
    [Fact]
    public async Task Login_MeerDan20VerzoekenPerMinuut_Geeft429()
    {
        // Arrange: verbruik alle 20 toegestane login-verzoeken
        var client = app.CreateClient();
        for (int poging = 1; poging <= 20; poging++)
        {
            await TestApp.LoginAsync(client, "bestaatniet@test.nl", "FoutWachtwoord");
        }

        // Act: nog één poging
        var response = await TestApp.LoginAsync(client, "bestaatniet@test.nl", "FoutWachtwoord");

        // Assert: 429 Too Many Requests
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
    }
}