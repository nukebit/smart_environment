using Microsoft.EntityFrameworkCore;

namespace SmartEnvironment.Api.Data;

public static class DevelopmentData
{
    public static async Task InitializeAsync(AuthDbContext database)
    {
        var gebouwen = await database.Gebouwen.ToListAsync();
        var lokalen = await database.Lokalen.ToListAsync();
        var isLeeg = gebouwen.Count == 0 && lokalen.Count == 0;

        // Vul alleen een lege omgeving aan met de 3 pilotlokalen (1 per fysieke Urban Sense sensor).
        // Zo blijven eigen wijzigingen en verwijderde lokalen na een herstart behouden.
        if (!isLeeg) return;

        (string Naam, string[] Lokalen)[] voorbeelden =
        [
            ("Voorbeeldgebouw", ["1.02", "2.14", "3.05"])
        ];

        foreach (var voorbeeld in voorbeelden)
        {
            var gebouw = gebouwen.FirstOrDefault(item => item.Naam == voorbeeld.Naam)
                ?? new Gebouw { Naam = voorbeeld.Naam };

            foreach (var naam in voorbeeld.Lokalen)
            {
                if (lokalen.Any(lokaal => lokaal.GebouwId == gebouw.Id && lokaal.Naam == naam)) continue;
                database.Lokalen.Add(new Lokaal { Naam = naam, Gebouw = gebouw });
            }
        }

        await database.SaveChangesAsync();
    }
}
