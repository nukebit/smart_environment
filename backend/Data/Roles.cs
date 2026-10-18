namespace SmartEnvironment.Api.Data;

// The roles from the analysis document. Use these constants instead of typing
// the text by hand, so a typo cannot create a new role by accident.
public static class Roles
{
    public const string Beheerder = "Beheerder";
    public const string Docent = "Docent";

    public static readonly string[] All = [Beheerder, Docent];
}