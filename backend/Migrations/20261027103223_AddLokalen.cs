using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartEnvironment.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLokalen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Lokalen",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Naam = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false, collation: "NOCASE"),
                    Gebouw = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false, collation: "NOCASE")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Lokalen", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Lokalen_Gebouw_Naam",
                table: "Lokalen",
                columns: new[] { "Gebouw", "Naam" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Lokalen");
        }
    }
}
