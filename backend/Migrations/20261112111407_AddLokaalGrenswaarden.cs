using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartEnvironment.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLokaalGrenswaarden : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "HumidityMaximum",
                table: "Lokalen",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "HumidityMinimum",
                table: "Lokalen",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "PressureMaximum",
                table: "Lokalen",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "PressureMinimum",
                table: "Lokalen",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "TemperatureMaximum",
                table: "Lokalen",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "TemperatureMinimum",
                table: "Lokalen",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);
            // Preserve the administrator's existing settings for every existing room.
            migrationBuilder.Sql("""
                UPDATE Lokalen SET
                    TemperatureMinimum = COALESCE((SELECT Minimum FROM MeasurementLimits WHERE Id = 'temperature'), 19),
                    TemperatureMaximum = COALESCE((SELECT Maximum FROM MeasurementLimits WHERE Id = 'temperature'), 23.5),
                    HumidityMinimum = COALESCE((SELECT Minimum FROM MeasurementLimits WHERE Id = 'humidity'), 40),
                    HumidityMaximum = COALESCE((SELECT Maximum FROM MeasurementLimits WHERE Id = 'humidity'), 70),
                    PressureMinimum = COALESCE((SELECT Minimum FROM MeasurementLimits WHERE Id = 'pressure'), 1008),
                    PressureMaximum = COALESCE((SELECT Maximum FROM MeasurementLimits WHERE Id = 'pressure'), 1028);
                """);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HumidityMaximum",
                table: "Lokalen");

            migrationBuilder.DropColumn(
                name: "HumidityMinimum",
                table: "Lokalen");

            migrationBuilder.DropColumn(
                name: "PressureMaximum",
                table: "Lokalen");

            migrationBuilder.DropColumn(
                name: "PressureMinimum",
                table: "Lokalen");

            migrationBuilder.DropColumn(
                name: "TemperatureMaximum",
                table: "Lokalen");

            migrationBuilder.DropColumn(
                name: "TemperatureMinimum",
                table: "Lokalen");
        }
    }
}
