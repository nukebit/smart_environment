using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace SmartEnvironment.Api.Data;

// Our own user: everything from IdentityUser (email, password hash, lockout)
// plus the extra fields the Beheer screen needs.
public class AppUser : IdentityUser
{
    // Shown in the "Naam" column, for example "Sanne de Vries".
    [MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    // Shown in the "Laatst actief" column. Saved in UTC, null = never logged in.
    public DateTime? LastLoginAt { get; set; }
}