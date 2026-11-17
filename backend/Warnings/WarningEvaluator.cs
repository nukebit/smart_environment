using SmartEnvironment.Api.Sensors;

namespace SmartEnvironment.Api.Warnings;

public record WarningCondition(string Kind, string Title, string Advice, string Unit, double? Value, double? Limit, bool Immediate);

public static class WarningEvaluator
{
    public static bool ValidValue(string id, double? value) => value is double v && double.IsFinite(v) && id switch
    {
        "temperature" => v >= -273.15,
        "humidity" => v >= 0 && v <= 100,
        "pressure" => v > 0,
        _ => false
    };

    public static List<WarningCondition> Evaluate(UrbanSenseMeasurement m, IEnumerable<MeasurementLimit> limits, DateTime now)
    {
        if (m.Timestamp == default || m.Timestamp > now.AddMinutes(1))
            return [new("invalid-time", "Ongeldig meettijdstip", "Controleer de klok en tijdzone van de sensor.", "", null, null, true)];
        if (now - m.Timestamp > TimeSpan.FromMinutes(5))
            return [new("stale", "Geen recente sensordata", "Controleer de voeding en netwerkverbinding van de sensor en het tijdstip van de laatste meting.", "", null, null, true)];

        var conditions = new List<WarningCondition>();
        foreach (var limit in limits)
        {
            var (value, name, unit) = limit.Id switch
            {
                "temperature" => (m.Temperature, "Temperatuur", "°C"),
                "humidity" => (m.Humidity, "Luchtvochtigheid", "%"),
                _ => (m.Pressure, "Luchtdruk", "hPa")
            };
            if (!ValidValue(limit.Id, value))
            {
                conditions.Add(new(limit.Id + "-invalid", name + ": ongeldige meetwaarde",
                    "Controleer de sensor en de meeteenheid. Laat de sensor zo nodig nakijken.", unit, null, null, true));
                continue;
            }
            bool high = value > limit.Maximum, low = value < limit.Minimum;
            if (!high && !low) continue;
            var advice = limit.Id switch
            {
                "temperature" when high => "Controleer de verwarming en zonwering. Ventileer als de buitenlucht koeler is.",
                "temperature" => "Controleer de verwarming en onnodig openstaande ramen. Meld aanhoudende kou bij de beheerder.",
                "humidity" when high => "Controleer de ventilatie en mogelijke vochtbronnen. Meld aanhoudend hoge waarden bij de beheerder.",
                "humidity" => "Controleer de meting en de instellingen van verwarming en ventilatie met de beheerder.",
                _ => "Vergelijk de meting met een referentiemeting en controleer bij aanhoudende afwijkingen de sensor en de ingestelde grenswaarden."
            };
            conditions.Add(new(limit.Id + (high ? "-high" : "-low"), name + (high ? " te hoog" : " te laag"), advice, unit, value,
                high ? limit.Maximum : limit.Minimum, false));
        }
        return conditions;
    }
}
