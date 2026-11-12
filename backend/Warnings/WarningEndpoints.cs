using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SmartEnvironment.Api.Auth;
using SmartEnvironment.Api.Common;
using SmartEnvironment.Api.Data;

namespace SmartEnvironment.Api.Warnings;

public static class WarningEndpoints
{
    public record ReadRequest(bool IsRead);

    public static void MapWarningEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/warnings").RequireAuthorization()
            .DisableCookieRedirect().AddEndpointFilter(ApiFilters.NoCacheFilter);
        group.MapGet("/", async (AuthDbContext db, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var items = await db.SensorWarnings.AsNoTracking().Where(w => w.Confirmed)
                .OrderByDescending(w => w.CreatedAt).ThenByDescending(w => w.Id)
                .Select(w => new { w.Id, w.LokaalId, w.Room, w.Building, w.Kind, w.Title,
                    w.Advice, w.Unit, w.Value, w.Limit, w.CreatedAt, w.MeasuredAt,
                    isRead = db.WarningReads.Any(r => r.WarningId == w.Id && r.UserId == userId) })
                .ToListAsync();
            var monitor = await db.WarningMonitorStatuses.AsNoTracking().SingleOrDefaultAsync();
            return Results.Ok(new { items, monitor?.LastSuccessAt, monitor?.Error });
        });
        group.MapPut("/{id:int}/read", async (int id, ReadRequest request, AuthDbContext db, ClaimsPrincipal user) =>
        {
            if (!await db.SensorWarnings.AnyAsync(w => w.Id == id && w.Confirmed)) return Results.NotFound();
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            if (request.IsRead)
            {
                // Atomic and idempotent, including concurrent tabs.
                await db.Database.ExecuteSqlInterpolatedAsync($"INSERT OR IGNORE INTO WarningReads (WarningId, UserId, ReadAt) VALUES ({id}, {userId}, {DateTime.UtcNow})");
            }
            else await db.WarningReads.Where(r => r.WarningId == id && r.UserId == userId).ExecuteDeleteAsync();
            return Results.NoContent();
        }).AddEndpointFilter(ApiFilters.CsrfFilter);

        var limits = app.MapGroup("/api/measurement-limits").RequireAuthorization()
            .DisableCookieRedirect().AddEndpointFilter(ApiFilters.NoCacheFilter);
        limits.MapGet("/", async (AuthDbContext db) => Results.Ok(await db.MeasurementLimits.AsNoTracking().OrderBy(l => l.Id).ToListAsync()));
        limits.MapPut("/", async (MeasurementLimit[] request, AuthDbContext db) =>
        {
            string[] ids = ["temperature", "humidity", "pressure"];
            if (request.Length != 3 || request.Any(l => l is null) || !request.Select(l => l.Id).Order().SequenceEqual(ids.Order()) ||
                request.Any(l => !double.IsFinite(l.Minimum) || !double.IsFinite(l.Maximum) || l.Minimum >= l.Maximum ||
                    (l.Id == "temperature" && l.Minimum < -273.15) ||
                    (l.Id == "humidity" && (l.Minimum < 0 || l.Maximum > 100)) ||
                    (l.Id == "pressure" && l.Minimum <= 0)))
                return Results.BadRequest(new { message = "Vul voor alle drie metingen geldige grenzen in. De ondergrens moet lager zijn dan de bovengrens; vochtigheid: 0–100%, druk: groter dan 0." });
            var saved = await db.MeasurementLimits.ToListAsync();
            foreach (var limit in saved)
            {
                var input = request.Single(l => l.Id == limit.Id);
                limit.Minimum = input.Minimum;
                limit.Maximum = input.Maximum;
            }
            await db.SaveChangesAsync();
            return Results.Ok(saved);
        }).RequireAuthorization(p => p.RequireRole(Roles.Beheerder)).AddEndpointFilter(ApiFilters.CsrfFilter);
    }
}
