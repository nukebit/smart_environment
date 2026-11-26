using System.Net;
using System.Net.Http.Json;
using SmartEnvironment.Api.Data;
using SmartEnvironment.Api.Lokalen;

namespace SmartEnvironment.Api.Tests.Integration;

public class BuildingManagementTests(TestApp app) : IClassFixture<TestApp>
{
    [Fact]
    public async Task CreateBuilding_TrimsNameAndPersistsInOverview()
    {
        var name = "Gebouw-" + Guid.NewGuid().ToString("N");
        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Post, "/api/gebouwen", new { naam = "  " + name + "  " });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<Gebouw>();
        Assert.NotNull(created);
        Assert.Equal(name, created.Naam);
        var saved = await app.DocentClient.GetFromJsonAsync<List<Gebouw>>("/api/gebouwen");
        Assert.Contains(saved!, building => building.Id == created.Id && building.Naam == name);
    }

    [Fact]
    public async Task UpdateBuilding_PersistsNameAndUpdatesClassroomOverview()
    {
        var building = await CreateBuildingAsync();
        var room = await CreateClassroomAsync(building.Id);
        var name = "Gewijzigd-" + Guid.NewGuid().ToString("N");

        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Put, $"/api/gebouwen/{building.Id}", new { naam = name });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var saved = await app.DocentClient.GetFromJsonAsync<List<Gebouw>>("/api/gebouwen");
        Assert.Contains(saved!, item => item.Id == building.Id && item.Naam == name);
        var reloadedRoom = await app.DocentClient.GetFromJsonAsync<LokaalResponse>($"/api/lokalen/{room.Id}");
        Assert.Equal(name, reloadedRoom!.Gebouw);
    }

    [Fact]
    public async Task CreateBuilding_EmptyName_Returns400WithoutSaving()
    {
        var before = await app.BeheerderClient.GetFromJsonAsync<List<Gebouw>>("/api/gebouwen");

        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Post, "/api/gebouwen", new { naam = "   " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var after = await app.BeheerderClient.GetFromJsonAsync<List<Gebouw>>("/api/gebouwen");
        Assert.Equal(before!.Count, after!.Count);
    }

    [Fact]
    public async Task CreateBuilding_DuplicateNameIgnoringCase_Returns409()
    {
        var building = await CreateBuildingAsync();

        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Post, "/api/gebouwen", new { naam = "  " + building.Naam.ToUpperInvariant() + "  " });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task UpdateBuilding_DuplicateName_LeavesExistingNameUnchanged()
    {
        var first = await CreateBuildingAsync();
        var second = await CreateBuildingAsync();

        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Put, $"/api/gebouwen/{second.Id}", new { naam = first.Naam });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var saved = await app.BeheerderClient.GetFromJsonAsync<List<Gebouw>>("/api/gebouwen");
        Assert.Contains(saved!, building => building.Id == second.Id && building.Naam == second.Naam);
    }

    [Fact]
    public async Task DeleteBuilding_WithClassroom_Returns409AndPreservesData()
    {
        var building = await CreateBuildingAsync();
        var room = await CreateClassroomAsync(building.Id);

        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Delete, $"/api/gebouwen/{building.Id}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var reloaded = await app.DocentClient.GetFromJsonAsync<LokaalResponse>($"/api/lokalen/{room.Id}");
        Assert.Equal(room, reloaded);
        var saved = await app.DocentClient.GetFromJsonAsync<List<Gebouw>>("/api/gebouwen");
        Assert.Contains(saved!, item => item.Id == building.Id);
    }

    [Fact]
    public async Task DeleteBuilding_EmptyBuilding_Returns204AndRemovesFromOverview()
    {
        var building = await CreateBuildingAsync();

        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Delete, $"/api/gebouwen/{building.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var saved = await app.DocentClient.GetFromJsonAsync<List<Gebouw>>("/api/gebouwen");
        Assert.DoesNotContain(saved!, item => item.Id == building.Id);
    }

    [Theory]
    [InlineData("POST")]
    [InlineData("PUT")]
    [InlineData("DELETE")]
    public async Task ChangeBuilding_AsTeacher_Returns403AndPreservesBuilding(string method)
    {
        var building = await CreateBuildingAsync();
        var path = method == "POST" ? "/api/gebouwen" : $"/api/gebouwen/{building.Id}";

        var response = await TestApp.SendAsync(app.DocentClient, new HttpMethod(method), path, new { naam = "Verboden gebouw" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var saved = await app.BeheerderClient.GetFromJsonAsync<List<Gebouw>>("/api/gebouwen");
        Assert.Contains(saved!, item => item.Id == building.Id && item.Naam == building.Naam);
        Assert.DoesNotContain(saved!, item => item.Naam == "Verboden gebouw");
    }

    [Theory]
    [InlineData("POST")]
    [InlineData("PUT")]
    [InlineData("DELETE")]
    public async Task ChangeBuilding_WithoutCsrf_Returns400AndPreservesBuilding(string method)
    {
        var building = await CreateBuildingAsync();
        var path = method == "POST" ? "/api/gebouwen" : $"/api/gebouwen/{building.Id}";
        using var request = new HttpRequestMessage(new HttpMethod(method), path)
        {
            Content = JsonContent.Create(new { naam = "Zonder token" })
        };

        var response = await app.BeheerderClient.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var saved = await app.BeheerderClient.GetFromJsonAsync<List<Gebouw>>("/api/gebouwen");
        Assert.Contains(saved!, item => item.Id == building.Id && item.Naam == building.Naam);
    }

    [Theory]
    [InlineData("PUT")]
    [InlineData("DELETE")]
    public async Task ChangeBuilding_UnknownId_Returns404(string method)
    {
        var response = await TestApp.SendAsync(app.BeheerderClient, new HttpMethod(method), $"/api/gebouwen/{int.MaxValue}", new { naam = "Onbekend gebouw" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<Gebouw> CreateBuildingAsync()
    {
        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Post, "/api/gebouwen", new { naam = "Testgebouw-" + Guid.NewGuid().ToString("N") });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<Gebouw>())!;
    }

    private async Task<LokaalResponse> CreateClassroomAsync(int buildingId)
    {
        var request = new LokaalRequest
        {
            Naam = "Test 2.14",
            GebouwId = buildingId,
            TemperatureMinimum = 19,
            TemperatureMaximum = 23.5,
            HumidityMinimum = 40,
            HumidityMaximum = 70,
            PressureMinimum = 1008,
            PressureMaximum = 1028
        };
        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Post, "/api/lokalen", request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<LokaalResponse>())!;
    }
}
