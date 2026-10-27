using System.ComponentModel.DataAnnotations;

namespace SmartEnvironment.Api.Users;

// JSON body for POST /api/users (Nieuwe docent toevoegen).
// UserEndpoints checks these rules and returns 400 with the messages below.
public class CreateUserRequest
{
    [Required(ErrorMessage = "Vul een naam in.")]
    [StringLength(100, ErrorMessage = "De naam mag maximaal 100 tekens zijn.")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vul een e-mailadres in.")]
    [EmailAddress(ErrorMessage = "Vul een geldig e-mailadres in.")]
    [StringLength(254)]
    public string Email { get; set; } = string.Empty;

    // "Docent" or "Beheerder". UserEndpoints checks that the role exists.
    [Required(ErrorMessage = "Kies een rol.")]
    public string Role { get; set; } = string.Empty;

    // Temporary password that the Beheerder gives to the docent.
    // Identity also checks the password rules from AuthSetup.cs.
    [Required(ErrorMessage = "Vul een tijdelijk wachtwoord in.")]
    [StringLength(512)]
    public string Password { get; set; } = string.Empty;
}

// JSON body for PUT /api/users/{id} (Bewerken). The password is not changed here.
public class UpdateUserRequest
{
    [Required(ErrorMessage = "Vul een naam in.")]
    [StringLength(100, ErrorMessage = "De naam mag maximaal 100 tekens zijn.")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vul een e-mailadres in.")]
    [EmailAddress(ErrorMessage = "Vul een geldig e-mailadres in.")]
    [StringLength(254)]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Kies een rol.")]
    public string Role { get; set; } = string.Empty;
}

// What the API sends back for one user. The password hash is never sent.
public record UserResponse(
    string Id,
    string FullName,
    string Email,
    string Role,
    DateTime? LastLoginAt);