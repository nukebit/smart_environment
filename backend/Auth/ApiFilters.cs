using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;

namespace SmartEnvironment.Api.Auth;

// Shared helpers for Minimal API endpoints, so every endpoint file can reuse them.
public static class ApiFilters
{
    // Stops the request with 400 when the CSRF cookie and X-CSRF-TOKEN header do not match.
    // Use on every POST, PUT and DELETE, because those requests change data.
    public static async ValueTask<object?> CsrfFilter(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var antiforgery = context.HttpContext.RequestServices.GetRequiredService<IAntiforgery>();

        if (!await antiforgery.IsRequestValidAsync(context.HttpContext))
        {
            return Results.BadRequest(new { message = "Invalid CSRF token." });
        }

        return await next(context);
    }

    // Adds Cache-Control: no-store, so the browser never caches account data.
    public static async ValueTask<object?> NoCacheFilter(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        context.HttpContext.Response.Headers.CacheControl = "no-store";
        return await next(context);
    }

    // Checks the validation attributes ([Required], [EmailAddress], ...) of a request class.
    // Returns null when everything is valid, otherwise a 400 response with the errors per field.
    public static IResult? Validate(object request)
    {
        var results = new List<ValidationResult>();
        var context = new ValidationContext(request);

        if (Validator.TryValidateObject(request, context, results, validateAllProperties: true))
        {
            return null;
        }

        var errors = results
            .GroupBy(result => result.MemberNames.FirstOrDefault() ?? string.Empty)
            .ToDictionary(
                group => group.Key,
                group => group.Select(result => result.ErrorMessage ?? "Ongeldige invoer.").ToArray());

        return Results.ValidationProblem(errors);
    }

    // Turns Identity errors (for example "Email is already taken") into a 400 response.
    public static IResult IdentityErrors(IdentityResult result)
    {
        var errors = result.Errors
            .GroupBy(error => error.Code)
            .ToDictionary(
                group => group.Key,
                group => group.Select(error => error.Description).ToArray());

        return Results.ValidationProblem(errors);
    }

    // A 400 response with one error message for one field.
    public static IResult FieldError(string field, string message)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [field] = [message]
        });
    }
}