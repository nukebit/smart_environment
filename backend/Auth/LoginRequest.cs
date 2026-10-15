using System.ComponentModel.DataAnnotations;

namespace SmartEnvironment.Api.Auth;

// The JSON body for login. Invalid fields automatically return 400.
public class LoginRequest
{
    // Required email, up to 254 characters.
    [Required, EmailAddress, StringLength(254)]
    public string Email { get; set; } = string.Empty;

    // Required password, up to 512 characters. Identity checks whether it is correct.
    [Required, StringLength(512)]
    public string Password { get; set; } = string.Empty;
}
