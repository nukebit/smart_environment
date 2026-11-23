using Microsoft.AspNetCore.Http;
using SmartEnvironment.Api.Common;
using SmartEnvironment.Api.Gebouwen;
using SmartEnvironment.Api.Lokalen;

namespace SmartEnvironment.Api.Tests.Unit;

// Calls the API's input validation directly, without starting a server or database.
public class ClassroomValidationTests
{
    // Classroom and building names are required and can be up to 100 characters long.
    public static TheoryData<string> InvalidNames => new()
    {
        "",
        "   ",
        new string('a', 101)
    };

    [Fact]
    public void Validate_ValidClassroom_ReturnsNoError()
    {
        Assert.Null(ApiFilters.Validate(CreateValidClassroomRequest()));
    }

    [Fact]
    public void Validate_ClassroomAtAllowedBoundaries_ReturnsNoError()
    {
        // A 100-character name, absolute zero, and humidity limits of 0% and 100% are valid.
        var request = CreateValidClassroomRequest();
        request.Naam = new string('a', 100);
        request.TemperatureMinimum = -273.15;
        request.HumidityMinimum = 0;
        request.HumidityMaximum = 100;

        Assert.Null(ApiFilters.Validate(request));
    }

    [Theory]
    [MemberData(nameof(InvalidNames))]
    public void Validate_ClassroomWithInvalidName_ReturnsNameError(string name)
    {
        var request = CreateValidClassroomRequest();
        request.Naam = name;

        Assert.Contains(nameof(LokaalRequest.Naam), GetValidationErrors(request).Keys);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0)]
    [InlineData(-1)]
    public void Validate_ClassroomWithInvalidBuildingId_ReturnsBuildingIdError(int? buildingId)
    {
        var request = CreateValidClassroomRequest();
        request.GebouwId = buildingId;

        Assert.Contains(nameof(LokaalRequest.GebouwId), GetValidationErrors(request).Keys);
    }

    [Fact]
    public void Validate_ClassroomWithoutLimits_ReturnsErrorsForAllLimits()
    {
        var request = new LokaalRequest { Naam = "2.14", GebouwId = 1 };

        var errors = GetValidationErrors(request);

        Assert.Contains(nameof(LokaalRequest.TemperatureMinimum), errors.Keys);
        Assert.Contains(nameof(LokaalRequest.TemperatureMaximum), errors.Keys);
        Assert.Contains(nameof(LokaalRequest.HumidityMinimum), errors.Keys);
        Assert.Contains(nameof(LokaalRequest.HumidityMaximum), errors.Keys);
        Assert.Contains(nameof(LokaalRequest.PressureMinimum), errors.Keys);
        Assert.Contains(nameof(LokaalRequest.PressureMaximum), errors.Keys);
    }

    [Theory]
    [InlineData(20.0, 20.0)]
    [InlineData(24.0, 20.0)]
    [InlineData(-273.16, 24.0)]
    [InlineData(double.NaN, 24.0)]
    [InlineData(19.0, double.PositiveInfinity)]
    public void Validate_ClassroomWithInvalidTemperatureRange_ReturnsTemperatureError(double minimum, double maximum)
    {
        var request = CreateValidClassroomRequest();
        request.TemperatureMinimum = minimum;
        request.TemperatureMaximum = maximum;

        // The API reports an invalid range under its minimum field.
        Assert.Contains("temperatureMinimum", GetValidationErrors(request).Keys);
    }

    [Theory]
    [InlineData(-0.1, 70.0)]
    [InlineData(40.0, 100.1)]
    [InlineData(70.0, 40.0)]
    public void Validate_ClassroomWithInvalidHumidityRange_ReturnsHumidityError(double minimum, double maximum)
    {
        var request = CreateValidClassroomRequest();
        request.HumidityMinimum = minimum;
        request.HumidityMaximum = maximum;

        Assert.Contains("humidityMinimum", GetValidationErrors(request).Keys);
    }

    [Theory]
    [InlineData(0.0, 1028.0)]
    [InlineData(-1.0, 1028.0)]
    [InlineData(1028.0, 1008.0)]
    public void Validate_ClassroomWithInvalidPressureRange_ReturnsPressureError(double minimum, double maximum)
    {
        var request = CreateValidClassroomRequest();
        request.PressureMinimum = minimum;
        request.PressureMaximum = maximum;

        Assert.Contains("pressureMinimum", GetValidationErrors(request).Keys);
    }

    [Fact]
    public void Validate_BuildingWith100CharacterName_ReturnsNoError()
    {
        var request = new GebouwRequest { Naam = new string('a', 100) };

        Assert.Null(ApiFilters.Validate(request));
    }

    [Theory]
    [MemberData(nameof(InvalidNames))]
    public void Validate_BuildingWithInvalidName_ReturnsNameError(string name)
    {
        var request = new GebouwRequest { Naam = name };

        Assert.Contains(nameof(GebouwRequest.Naam), GetValidationErrors(request).Keys);
    }

    // This test checks the ID value. The endpoint checks whether the classroom exists.
    [Fact]
    public void Validate_ActiveClassroomWithPositiveId_ReturnsNoError()
    {
        var request = new ActiefLokaalRequest { LokaalId = 1 };

        Assert.Null(ApiFilters.Validate(request));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Validate_ActiveClassroomWithInvalidId_ReturnsClassroomIdError(int classroomId)
    {
        var request = new ActiefLokaalRequest { LokaalId = classroomId };

        Assert.Contains(nameof(ActiefLokaalRequest.LokaalId), GetValidationErrors(request).Keys);
    }

    // Each test starts with a fresh valid request and changes the relevant inputs.
    private static LokaalRequest CreateValidClassroomRequest() => new()
    {
        Naam = "2.14",
        GebouwId = 1,
        TemperatureMinimum = 19,
        TemperatureMaximum = 23.5,
        HumidityMinimum = 40,
        HumidityMaximum = 70,
        PressureMinimum = 1008,
        PressureMaximum = 1028
    };

    private static IDictionary<string, string[]> GetValidationErrors(object request)
    {
        var result = ApiFilters.Validate(request);
        // The 400 response groups validation errors by field.
        Assert.Equal(StatusCodes.Status400BadRequest, Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
        var problem = Assert.IsType<HttpValidationProblemDetails>(Assert.IsAssignableFrom<IValueHttpResult>(result).Value);
        return problem.Errors;
    }
}
