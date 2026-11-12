using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SmartEnvironment.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWarningsAndMeasurementLimits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MeasurementLimits",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    Minimum = table.Column<double>(type: "REAL", nullable: false),
                    Maximum = table.Column<double>(type: "REAL", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MeasurementLimits", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SensorWarnings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    LokaalId = table.Column<int>(type: "INTEGER", nullable: false),
                    Room = table.Column<string>(type: "TEXT", nullable: false),
                    Building = table.Column<string>(type: "TEXT", nullable: false),
                    Kind = table.Column<string>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Advice = table.Column<string>(type: "TEXT", nullable: false),
                    Unit = table.Column<string>(type: "TEXT", nullable: false),
                    Value = table.Column<double>(type: "REAL", nullable: true),
                    Limit = table.Column<double>(type: "REAL", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    MeasuredAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IsOpen = table.Column<bool>(type: "INTEGER", nullable: false),
                    Confirmed = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SensorWarnings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WarningMonitorStatuses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    LastSuccessAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Error = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WarningMonitorStatuses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WarningReads",
                columns: table => new
                {
                    WarningId = table.Column<int>(type: "INTEGER", nullable: false),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WarningReads", x => new { x.WarningId, x.UserId });
                    table.ForeignKey(
                        name: "FK_WarningReads_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WarningReads_SensorWarnings_WarningId",
                        column: x => x.WarningId,
                        principalTable: "SensorWarnings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "MeasurementLimits",
                columns: new[] { "Id", "Maximum", "Minimum" },
                values: new object[,]
                {
                    { "humidity", 70.0, 40.0 },
                    { "pressure", 1028.0, 1008.0 },
                    { "temperature", 23.5, 19.0 }
                });

            migrationBuilder.InsertData(
                table: "WarningMonitorStatuses",
                columns: new[] { "Id", "Error", "LastSuccessAt" },
                values: new object[] { 1, null, null });

            migrationBuilder.CreateIndex(
                name: "IX_SensorWarnings_LokaalId_Kind",
                table: "SensorWarnings",
                columns: new[] { "LokaalId", "Kind" },
                unique: true,
                filter: "IsOpen = 1");

            migrationBuilder.CreateIndex(
                name: "IX_WarningReads_UserId",
                table: "WarningReads",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MeasurementLimits");

            migrationBuilder.DropTable(
                name: "WarningMonitorStatuses");

            migrationBuilder.DropTable(
                name: "WarningReads");

            migrationBuilder.DropTable(
                name: "SensorWarnings");
        }
    }
}
