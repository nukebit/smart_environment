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

    }
}
