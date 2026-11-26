using System.Net;
using System.Net.Http.Json;
using SmartEnvironment.Api.Data;
using SmartEnvironment.Api.Gebouwen;
using SmartEnvironment.Api.Lokalen;

namespace SmartEnvironment.Api.Tests.Integration;

public class ClassroomManagementTests(TestApp app) : IClassFixture<TestApp>
{
    [Fact]
    public async Task CreateClassroom_ValidRequest_PersistsAllFields()
    {
        var building = await CreateBuildingAsync();
        var request = ClassroomRequest(building.Id, "  Test 2.14  ");

        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Post, "/api/lokalen", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<LokaalResponse>();
        Assert.NotNull(created);
        Assert.Equal($"/api/lokalen/{created.Id}", response.Headers.Location?.ToString());
        Assert.Equal("Test 2.14", created.Naam);
        Assert.Equal(building.Naam, created.Gebouw);
        AssertFields(request, created);

        using var reader = await app.CreateLoggedInClientAsync(TestApp.DocentEmail);
        var reloaded = await reader.GetFromJsonAsync<LokaalResponse>($"/api/lokalen/{created.Id}");
        Assert.Equal(created, reloaded);
        var list = await reader.GetFromJsonAsync<List<LokaalResponse>>("/api/lokalen");
        Assert.Contains(created, list!);
    }

    [Fact]
    public async Task UpdateClassroom_NameBuildingAndLimits_PersistsAfterNewRequest()
    {
        var original = await CreateClassroomAsync();
        var building = await CreateBuildingAsync();
        var request = ClassroomRequest(building.Id, "  Gewijzigd 2.15  ");
        request.TemperatureMinimum = -20;
        request.TemperatureMaximum = 25;
        request.HumidityMinimum = 30;
        request.HumidityMaximum = 80;
        request.PressureMinimum = 990;
        request.PressureMaximum = 1040;

        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Put, $"/api/lokalen/{original.Id}", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var reader = await app.CreateLoggedInClientAsync(TestApp.BeheerderEmail);
        var saved = await reader.GetFromJsonAsync<LokaalResponse>($"/api/lokalen/{original.Id}");
        Assert.NotNull(saved);
        Assert.Equal(original.Id, saved.Id);
        Assert.Equal("Gewijzigd 2.15", saved.Naam);
        Assert.Equal(building.Naam, saved.Gebouw);
        AssertFields(request, saved);
    }

    [Fact]
    public async Task CreateClassroom_ReversedLimits_Returns400WithoutSaving()
    {
        var building = await CreateBuildingAsync();
        var request = ClassroomRequest(building.Id, "Ongeldige grenzen");
        request.TemperatureMinimum = 24;
        request.TemperatureMaximum = 20;

        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Post, "/api/lokalen", request);

        await AssertValidationErrorAsync(response, "temperatureMinimum");
        var list = await app.BeheerderClient.GetFromJsonAsync<List<LokaalResponse>>("/api/lokalen");
        Assert.DoesNotContain(list!, room => room.GebouwId == building.Id);
    }

    [Fact]
    public async Task UpdateClassroom_InvalidLimits_LeavesSavedValuesUnchanged()
    {
        var original = await CreateClassroomAsync();
        var request = ClassroomRequest(original.GebouwId, "Niet opslaan");
        request.HumidityMaximum = 101;

        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Put, $"/api/lokalen/{original.Id}", request);

        await AssertValidationErrorAsync(response, "humidityMinimum");
        var saved = await app.BeheerderClient.GetFromJsonAsync<LokaalResponse>($"/api/lokalen/{original.Id}");
        Assert.Equal(original, saved);
    }

    [Fact]
    public async Task CreateClassroom_UnknownBuilding_ReturnsFieldError()
    {
        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Post, "/api/lokalen", ClassroomRequest(int.MaxValue));

        await AssertValidationErrorAsync(response, "gebouwId");
    }

    [Fact]
    public async Task CreateClassroom_DuplicateNameInSameBuilding_Returns409()
    {
        var original = await CreateClassroomAsync();
        var request = ClassroomRequest(original.GebouwId, "  " + original.Naam.ToUpperInvariant() + "  ");

        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Post, "/api/lokalen", request);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var saved = await app.BeheerderClient.GetFromJsonAsync<List<LokaalResponse>>("/api/lokalen");
        Assert.Single(saved!, room => room.GebouwId == original.GebouwId);
    }

    [Fact]
    public async Task CreateClassroom_SameNameInDifferentBuilding_IsAllowed()
    {
        var original = await CreateClassroomAsync();
        var building = await CreateBuildingAsync();

        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Post, "/api/lokalen", ClassroomRequest(building.Id, original.Naam));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var saved = await response.Content.ReadFromJsonAsync<LokaalResponse>();
        Assert.NotNull(saved);
        Assert.NotEqual(original.Id, saved.Id);
        Assert.Equal(building.Id, saved.GebouwId);
    }

    [Theory]
    [InlineData("POST")]
    [InlineData("PUT")]
    [InlineData("DELETE")]
    public async Task ChangeClassroom_AsTeacher_Returns403WithoutChangingData(string method)
    {
        var original = await CreateClassroomAsync();
        var path = method == "POST" ? "/api/lokalen" : $"/api/lokalen/{original.Id}";

        var response = await TestApp.SendAsync(app.DocentClient, new HttpMethod(method), path, ClassroomRequest(original.GebouwId, "Verboden wijziging"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var saved = await app.BeheerderClient.GetFromJsonAsync<LokaalResponse>($"/api/lokalen/{original.Id}");
        Assert.Equal(original, saved);
        var list = await app.BeheerderClient.GetFromJsonAsync<List<LokaalResponse>>("/api/lokalen");
        Assert.Single(list!, room => room.GebouwId == original.GebouwId);
    }

    [Theory]
    [InlineData("POST")]
    [InlineData("PUT")]
    [InlineData("DELETE")]
    public async Task ChangeClassroom_WithoutCsrf_Returns400WithoutChangingData(string method)
    {
        var original = await CreateClassroomAsync();
        var path = method == "POST" ? "/api/lokalen" : $"/api/lokalen/{original.Id}";
        using var request = new HttpRequestMessage(new HttpMethod(method), path)
        {
            Content = JsonContent.Create(ClassroomRequest(original.GebouwId, "Zonder token"))
        };

        var response = await app.BeheerderClient.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var saved = await app.BeheerderClient.GetFromJsonAsync<LokaalResponse>($"/api/lokalen/{original.Id}");
        Assert.Equal(original, saved);
    }

    [Theory]
    [InlineData("/api/lokalen")]
    [InlineData("/api/lokalen/actief")]
    [InlineData("/api/gebouwen")]
    public async Task ReadClassrooms_WithoutLogin_Returns401(string path)
    {
        using var client = app.CreateClient();

        var response = await client.GetAsync(path);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("GET")]
    [InlineData("PUT")]
    [InlineData("DELETE")]
    public async Task AccessClassroom_UnknownId_Returns404(string method)
    {
        var building = await CreateBuildingAsync();
        var response = method == "GET"
            ? await app.BeheerderClient.GetAsync($"/api/lokalen/{int.MaxValue}")
            : await TestApp.SendAsync(app.BeheerderClient, new HttpMethod(method), $"/api/lokalen/{int.MaxValue}", ClassroomRequest(building.Id));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SelectClassroom_PersistsPerUserAcrossSessions()
    {
        var teacherRoom = await CreateClassroomAsync();
        var adminRoom = await CreateClassroomAsync();
        var teacherResponse = await TestApp.SendAsync(app.DocentClient, HttpMethod.Put, "/api/lokalen/actief", new { lokaalId = teacherRoom.Id });
        var adminResponse = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Put, "/api/lokalen/actief", new { lokaalId = adminRoom.Id });
        Assert.Equal(HttpStatusCode.OK, teacherResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, adminResponse.StatusCode);

        using var reader = await app.CreateLoggedInClientAsync(TestApp.DocentEmail);
        var teacherChoice = await reader.GetFromJsonAsync<ClassroomChoice>("/api/lokalen/actief");
        var adminChoice = await app.BeheerderClient.GetFromJsonAsync<ClassroomChoice>("/api/lokalen/actief");

        Assert.Equal(teacherRoom, teacherChoice!.Lokaal);
        Assert.Equal(adminRoom, adminChoice!.Lokaal);
    }

    [Fact]
    public async Task DeleteClassroom_RemovesRoomAndSavedPreference()
    {
        var original = await CreateClassroomAsync();
        var selection = await TestApp.SendAsync(app.DocentClient, HttpMethod.Put, "/api/lokalen/actief", new { lokaalId = original.Id });
        Assert.Equal(HttpStatusCode.OK, selection.StatusCode);

        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Delete, $"/api/lokalen/{original.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var get = await app.DocentClient.GetAsync($"/api/lokalen/{original.Id}");
        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
        var choice = await app.DocentClient.GetFromJsonAsync<ClassroomChoice>("/api/lokalen/actief");
        Assert.Null(choice!.Lokaal);
    }

    private async Task<Gebouw> CreateBuildingAsync()
    {
        var request = new GebouwRequest { Naam = "Testgebouw-" + Guid.NewGuid().ToString("N") };
        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Post, "/api/gebouwen", request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<Gebouw>())!;
    }

    private async Task<LokaalResponse> CreateClassroomAsync()
    {
        var building = await CreateBuildingAsync();
        var response = await TestApp.SendAsync(app.BeheerderClient, HttpMethod.Post, "/api/lokalen", ClassroomRequest(building.Id));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<LokaalResponse>())!;
    }

    private static LokaalRequest ClassroomRequest(int buildingId, string name = "Test 2.14") => new()
    {
        Naam = name,
        GebouwId = buildingId,
        TemperatureMinimum = 19,
        TemperatureMaximum = 23.5,
        HumidityMinimum = 40,
        HumidityMaximum = 70,
        PressureMinimum = 1008,
        PressureMaximum = 1028
    };

    private static void AssertFields(LokaalRequest expected, LokaalResponse actual)
    {
        Assert.Equal(expected.GebouwId, actual.GebouwId);
        Assert.Equal(expected.TemperatureMinimum, actual.TemperatureMinimum);
        Assert.Equal(expected.TemperatureMaximum, actual.TemperatureMaximum);
        Assert.Equal(expected.HumidityMinimum, actual.HumidityMinimum);
        Assert.Equal(expected.HumidityMaximum, actual.HumidityMaximum);
        Assert.Equal(expected.PressureMinimum, actual.PressureMinimum);
        Assert.Equal(expected.PressureMaximum, actual.PressureMaximum);
    }

    private static async Task AssertValidationErrorAsync(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblem>();
        Assert.Contains(field, problem!.Errors.Keys);
    }

    private record ClassroomChoice(LokaalResponse? Lokaal);
    private record ValidationProblem(Dictionary<string, string[]> Errors);
}
