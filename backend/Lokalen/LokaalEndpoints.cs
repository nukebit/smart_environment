using System.Security.Claims;
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
            .RequireAuthorization(policy => policy.RequireRole(Roles.Beheerder, Roles.Docent))
            .DisableCookieRedirect()
            .AddEndpointFilter(ApiFilters.NoCacheFilter);

        group.MapGet("", GetAll);
        group.MapGet("/{id:int}", GetById);
        group.MapGet("/actief", GetActive);
        group.MapPut("/actief", SetActive).AddEndpointFilter(ApiFilters.CsrfFilter);

        // Bekijken en persoonlijk selecteren mag voor beide rollen; beheer alleen voor Beheerder.
        group.MapPost("", Create).RequireAuthorization(policy => policy.RequireRole(Roles.Beheerder))
            .AddEndpointFilter(ApiFilters.CsrfFilter);
        group.MapPut("/{id:int}", Update).RequireAuthorization(policy => policy.RequireRole(Roles.Beheerder))
            .AddEndpointFilter(ApiFilters.CsrfFilter);
        group.MapDelete("/{id:int}", Delete).RequireAuthorization(policy => policy.RequireRole(Roles.Beheerder))
            .AddEndpointFilter(ApiFilters.CsrfFilter);
    }

    private static async Task<IResult> GetActive(ClaimsPrincipal principal, AuthDbContext database, CancellationToken cancellationToken)
    {
        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        var lokaal = await database.LokaalKeuzes.AsNoTracking().Where(keuze => keuze.UserId == userId)
            .Select(keuze => new LokaalResponse(keuze.Lokaal.Id, keuze.Lokaal.Naam,
                keuze.Lokaal.GebouwId, keuze.Lokaal.Gebouw.Naam))
            .SingleOrDefaultAsync(cancellationToken);
        return Results.Ok(new { lokaal });
    }

    private static async Task<IResult> SetActive(ActiefLokaalRequest request, ClaimsPrincipal principal,
        AuthDbContext database, CancellationToken cancellationToken)
    {
        var invalid = ApiFilters.Validate(request);
        if (invalid is not null) return invalid;

        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Results.Unauthorized();
        var lokaal = await ToResponse(database.Lokalen.AsNoTracking().Where(item => item.Id == request.LokaalId))
            .SingleOrDefaultAsync(cancellationToken);
        if (lokaal is null) return Results.NotFound();

        // De unieke gebruikerssleutel houdt de selectie ook bij gelijktijdige verzoeken enkelvoudig.
        try
        {
            await database.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO "LokaalKeuzes" ("UserId", "LokaalId") VALUES ({userId}, {request.LokaalId})
                ON CONFLICT ("UserId") DO UPDATE SET "LokaalId" = excluded."LokaalId";
                """, cancellationToken);
        }
        catch (SqliteException exception) when (exception.SqliteExtendedErrorCode == 787)
        {
            return Results.NotFound();
        }
        return Results.Ok(new { lokaal });
    }

    private static async Task<IResult> GetAll(AuthDbContext database, CancellationToken cancellationToken)
    {
        var lokalen = await ToResponse(database.Lokalen.AsNoTracking()
            .OrderBy(lokaal => lokaal.Gebouw.Naam).ThenBy(lokaal => lokaal.Naam))
            .ToListAsync(cancellationToken);
        return Results.Ok(lokalen);
    }

    private static async Task<IResult> GetById(int id, AuthDbContext database, CancellationToken cancellationToken)
    {
        var lokaal = await ToResponse(database.Lokalen.AsNoTracking().Where(item => item.Id == id))
            .FirstOrDefaultAsync(cancellationToken);
        return lokaal is null ? Results.NotFound() : Results.Ok(lokaal);
    }

    private static async Task<IResult> Create(LokaalRequest request, AuthDbContext database, CancellationToken cancellationToken)
    {
        var invalid = ApiFilters.Validate(request);
        if (invalid is not null) return invalid;

        var gebouw = await database.Gebouwen.FindAsync([request.GebouwId], cancellationToken);
        if (gebouw is null) return ApiFilters.FieldError("gebouwId", "Selecteer een bestaand gebouw.");

        var lokaal = new Lokaal { Naam = request.Naam.Trim(), Gebouw = gebouw };
        database.Lokalen.Add(lokaal);

        var error = await SaveChanges(database, cancellationToken);
        return error ?? Results.Created($"/api/lokalen/{lokaal.Id}", new LokaalResponse(lokaal.Id, lokaal.Naam, gebouw.Id, gebouw.Naam));
    }

    private static async Task<IResult> Update(int id, LokaalRequest request, AuthDbContext database, CancellationToken cancellationToken)
    {
        var invalid = ApiFilters.Validate(request);
        if (invalid is not null) return invalid;

        var lokaal = await database.Lokalen.FindAsync([id], cancellationToken);
        if (lokaal is null) return Results.NotFound();

        var gebouw = await database.Gebouwen.FindAsync([request.GebouwId], cancellationToken);
        if (gebouw is null) return ApiFilters.FieldError("gebouwId", "Selecteer een bestaand gebouw.");

        lokaal.Naam = request.Naam.Trim();
        lokaal.Gebouw = gebouw;

        var error = await SaveChanges(database, cancellationToken);
        return error ?? Results.Ok(new LokaalResponse(lokaal.Id, lokaal.Naam, gebouw.Id, gebouw.Naam));
    }

    private static async Task<IResult> Delete(int id, AuthDbContext database, CancellationToken cancellationToken)
    {
        var lokaal = await database.Lokalen.FindAsync([id], cancellationToken);
        if (lokaal is null) return Results.NotFound();

        database.Lokalen.Remove(lokaal);
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static IQueryable<LokaalResponse> ToResponse(IQueryable<Lokaal> lokalen)
    {
        return lokalen.Select(lokaal =>
            new LokaalResponse(lokaal.Id, lokaal.Naam, lokaal.GebouwId, lokaal.Gebouw.Naam));
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
