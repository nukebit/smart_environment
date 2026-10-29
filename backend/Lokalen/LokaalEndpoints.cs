using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using SmartEnvironment.Api.Common;
using SmartEnvironment.Api.Data;

namespace SmartEnvironment.Api.Lokalen;

public static class LokaalEndpoints
{
    public static void MapLokaalEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/lokalen")
            .RequireAuthorization(policy => policy.RequireRole(Roles.Beheerder))
            .DisableCookieRedirect()
            .AddEndpointFilter(ApiFilters.NoCacheFilter);

        group.MapGet("", GetAll);
        group.MapGet("/{id:int}", GetById);
        group.MapPost("", Create).AddEndpointFilter(ApiFilters.CsrfFilter);
        group.MapPut("/{id:int}", Update).AddEndpointFilter(ApiFilters.CsrfFilter);
        group.MapDelete("/{id:int}", Delete).AddEndpointFilter(ApiFilters.CsrfFilter);
    }

    private static async Task<IResult> GetAll(AuthDbContext database, CancellationToken cancellationToken)
    {
        var lokalen = await database.Lokalen.AsNoTracking()
            .OrderBy(lokaal => lokaal.Gebouw).ThenBy(lokaal => lokaal.Naam)
            .ToListAsync(cancellationToken);
        return Results.Ok(lokalen);
    }

    private static async Task<IResult> GetById(int id, AuthDbContext database, CancellationToken cancellationToken)
    {
        var lokaal = await database.Lokalen.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        return lokaal is null ? Results.NotFound() : Results.Ok(lokaal);
    }

    private static async Task<IResult> Create(LokaalRequest request, AuthDbContext database, CancellationToken cancellationToken)
    {
        var invalid = ApiFilters.Validate(request);
        if (invalid is not null) return invalid;

        var lokaal = new Lokaal { Naam = request.Naam.Trim(), Gebouw = request.Gebouw.Trim() };
        database.Lokalen.Add(lokaal);

        var error = await SaveChanges(database, cancellationToken);
        return error ?? Results.Created($"/api/lokalen/{lokaal.Id}", lokaal);
    }

    private static async Task<IResult> Update(int id, LokaalRequest request, AuthDbContext database, CancellationToken cancellationToken)
    {
        var invalid = ApiFilters.Validate(request);
        if (invalid is not null) return invalid;

        var lokaal = await database.Lokalen.FindAsync([id], cancellationToken);
        if (lokaal is null) return Results.NotFound();

        lokaal.Naam = request.Naam.Trim();
        lokaal.Gebouw = request.Gebouw.Trim();

        var error = await SaveChanges(database, cancellationToken);
        return error ?? Results.Ok(lokaal);
    }

    private static async Task<IResult> Delete(int id, AuthDbContext database, CancellationToken cancellationToken)
    {
        var lokaal = await database.Lokalen.FindAsync([id], cancellationToken);
        if (lokaal is null) return Results.NotFound();

        database.Lokalen.Remove(lokaal);
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult?> SaveChanges(AuthDbContext database, CancellationToken cancellationToken)
    {
        try
        {
            await database.SaveChangesAsync(cancellationToken);
            return null;
        }
        catch (DbUpdateException exception) when (exception.InnerException is SqliteException { SqliteExtendedErrorCode: 2067 })
        {
            return Results.Conflict(new { message = "Dit lokaal bestaat al in dit gebouw." });
        }
    }
}
