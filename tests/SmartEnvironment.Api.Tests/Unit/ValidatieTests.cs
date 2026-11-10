using Microsoft.AspNetCore.Http;
using SmartEnvironment.Api.Auth;
using SmartEnvironment.Api.Common;
using SmartEnvironment.Api.Data;
using SmartEnvironment.Api.Users;

namespace SmartEnvironment.Api.Tests.Unit;

// UNIT TESTEN: we testen één methode los, zonder server, database of HTTP.
// Daarom zijn ze heel snel.
public class ValidatieTests
{
    private const string GeldigEmail = "docent@school.nl";
    private const string GeldigWachtwoord = "Wachtwoord123";

    [Fact]
    public void Validate_GeldigeLogin_GeeftGeenFout()
    {
        // Arrange
        var request = new LoginRequest { Email = GeldigEmail, Password = GeldigWachtwoord };

        // Act
        var result = ApiFilters.Validate(request);

        // Assert: null betekent "alles is goed"
        Assert.Null(result);
    }

    [Theory]
    [InlineData("")]                // leeg
    [InlineData("geen-emailadres")] // geen @
    public void Validate_LoginMetOngeldigEmail_Geeft400(string email)
    {
        // Arrange
        var request = new LoginRequest { Email = email, Password = GeldigWachtwoord };

        // Act
        var result = ApiFilters.Validate(request);

        // Assert
        Assert.Equal(StatusCodes.Status400BadRequest, StatusCode(result));
    }

    [Fact]
    public void Validate_LoginZonderWachtwoord_GeeftFoutBijPassword()
    {
        // Arrange
        var request = new LoginRequest { Email = GeldigEmail, Password = "" };

        // Act
        var result = ApiFilters.Validate(request);

        // Assert: de fout hoort bij het veld Password
        Assert.Contains("Password", Errors(result).Keys);
    }

    [Fact]
    public void Validate_NieuweDocentZonderNaam_GeeftNederlandseMelding()
    {
        // Arrange
        var request = new CreateUserRequest
        {
            FullName = "",
            Email = GeldigEmail,
            Role = Roles.Docent,
            Password = GeldigWachtwoord
        };

        // Act
        var result = ApiFilters.Validate(request);

        // Assert: precies de melding uit UserModels.cs
        Assert.Equal("Vul een naam in.", Errors(result)["FullName"][0]);
    }

    [Fact]
    public void Validate_NaamLangerDan100Tekens_Geeft400()
    {
        // Arrange
        var request = new UpdateUserRequest
        {
            FullName = new string('a', 101),
            Email = GeldigEmail,
            Role = Roles.Docent
        };

        // Act
        var result = ApiFilters.Validate(request);

        // Assert
        Assert.Equal("De naam mag maximaal 100 tekens zijn.", Errors(result)["FullName"][0]);
    }

    [Fact]
    public void FieldError_RolFout_GeeftMeldingBijVeldRole()
    {
        // Act
        var result = ApiFilters.FieldError("Role", "Kies Docent of Beheerder.");

        // Assert
        Assert.Equal("Kies Docent of Beheerder.", Errors(result)["Role"][0]);
    }

    [Fact]
    public void RolesAll_BevatPreciesBeheerderEnDocent()
    {
        // Arrange
        string[] verwacht = ["Beheerder", "Docent"];

        // Assert: er bestaan maar twee rollen
        Assert.Equal(verwacht, Roles.All);
    }

    // ----- Hulpmethodes: haal statuscode en fouten uit het IResult -----

    private static int? StatusCode(IResult? result)
    {
        return (result as IStatusCodeHttpResult)?.StatusCode;
    }

    private static IDictionary<string, string[]> Errors(IResult? result)
    {
        var problem = (result as IValueHttpResult)?.Value as HttpValidationProblemDetails;
        Assert.NotNull(problem);
        return problem.Errors;
    }
}