using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartEnvironment.Api.Migrations;

public partial class AddWarningFirstValue : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<double>(name: "FirstValue", table: "SensorWarnings", type: "REAL", nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "FirstValue", table: "SensorWarnings");
    }
}
