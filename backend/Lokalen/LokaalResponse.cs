namespace SmartEnvironment.Api.Lokalen;

public record LokaalResponse(int Id, string Naam, int GebouwId, string Gebouw, double TemperatureMinimum, double TemperatureMaximum, double HumidityMinimum, double HumidityMaximum, double PressureMinimum, double PressureMaximum);
