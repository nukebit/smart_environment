using Microsoft.EntityFrameworkCore;

namespace SmartEnvironment.Api.Data;

public static class DevelopmentData
{
    public static async Task InitializeAsync(AuthDbContext database)
    {
        var gebouwen = await database.Gebouwen.ToListAsync();
        var lokalen = await database.Lokalen.ToListAsync();
        string[] oudeNamen = ["1.02", "2.14", "3.05"];

        var isLeeg = gebouwen.Count == 0 && lokalen.Count == 0;
        var heeftOudeStartgegevens = gebouwen.Count == 1
            && gebouwen[0].Naam == "Voorbeeldgebouw"
            && lokalen.Count == 3
            && lokalen.All(lokaal => lokaal.GebouwId == gebouwen[0].Id && oudeNamen.Contains(lokaal.Naam));

        // Vul alleen een lege omgeving of de oorspronkelijke drie voorbeeldlokalen aan.
        // Zo blijven eigen wijzigingen en verwijderde lokalen na een herstart behouden.
        if (!isLeeg && !heeftOudeStartgegevens) return;

        (string Naam, string[] Lokalen)[] voorbeelden =
        [
            ("Voorbeeldgebouw", ["1.01", "1.02", "1.03", "1.04", "2.01", "2.02", "2.14", "3.01", "3.02", "3.05"]),
            ("Gebouw B", ["B.01", "B.02", "B.03", "B.04", "B.05", "B.06"]),
            ("Gebouw C", ["C.01", "C.02", "C.03", "C.04"])
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
