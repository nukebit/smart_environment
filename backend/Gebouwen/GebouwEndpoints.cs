using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using SmartEnvironment.Api.Common;
using SmartEnvironment.Api.Data;

namespace SmartEnvironment.Api.Gebouwen;

public static class GebouwEndpoints
{
    public static void MapGebouwEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/gebouwen")
            .RequireAuthorization(policy => policy.RequireRole(Roles.Beheerder))
            .DisableCookieRedirect()
            .AddEndpointFilter(ApiFilters.NoCacheFilter);

        group.MapGet("", GetAll);
        group.MapPost("", Create).AddEndpointFilter(ApiFilters.CsrfFilter);
    }

    private static async Task<IResult> GetAll(AuthDbContext database, CancellationToken cancellationToken)
    {
        var gebouwen = await database.Gebouwen.AsNoTracking()
            .OrderBy(gebouw => gebouw.Naam).ToListAsync(cancellationToken);
        return Results.Ok(gebouwen);
    }

    private static async Task<IResult> Create(GebouwRequest request, AuthDbContext database, CancellationToken cancellationToken)
    {
        var invalid = ApiFilters.Validate(request);
        if (invalid is not null) return invalid;

        var gebouw = new Gebouw { Naam = request.Naam.Trim() };
        database.Gebouwen.Add(gebouw);

        try
        {
            await database.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is SqliteException { SqliteExtendedErrorCode: 2067 })
        {
            return Results.Conflict(new { message = "Dit gebouw bestaat al." });
        }

        return Results.Created("/api/gebouwen", gebouw);
    }
}
