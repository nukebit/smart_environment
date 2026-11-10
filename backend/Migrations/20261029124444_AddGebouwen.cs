using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartEnvironment.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGebouwen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Gebouwen",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Naam = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false, collation: "NOCASE")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Gebouwen", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Gebouwen_Naam",
                table: "Gebouwen",
                column: "Naam",
                unique: true);

            // Neem bestaande gebouwnamen over voordat de tekstkolom wordt vervangen.
            migrationBuilder.Sql("""
                INSERT INTO "Gebouwen" ("Naam")
                SELECT "Gebouw" FROM "Lokalen" GROUP BY "Gebouw" COLLATE NOCASE;
                """);

            migrationBuilder.CreateTable(
                name: "LokalenNieuw",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Naam = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false, collation: "NOCASE"),
                    GebouwId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Lokalen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Lokalen_Gebouwen_GebouwId",
                        column: x => x.GebouwId,
                        principalTable: "Gebouwen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.Sql("""
                INSERT INTO "LokalenNieuw" ("Id", "Naam", "GebouwId")
                SELECT l."Id", l."Naam", g."Id"
                FROM "Lokalen" l JOIN "Gebouwen" g ON l."Gebouw" = g."Naam" COLLATE NOCASE;
                """);

            migrationBuilder.DropTable(name: "Lokalen");
            migrationBuilder.RenameTable(name: "LokalenNieuw", newName: "Lokalen");
            migrationBuilder.CreateIndex(
                name: "IX_Lokalen_GebouwId_Naam",
                table: "Lokalen",
                columns: new[] { "GebouwId", "Naam" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LokalenOud",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Naam = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false, collation: "NOCASE"),
                    Gebouw = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false, collation: "NOCASE")
                },
                constraints: table => table.PrimaryKey("PK_Lokalen", x => x.Id));

            migrationBuilder.Sql("""
                INSERT INTO "LokalenOud" ("Id", "Naam", "Gebouw")
                SELECT l."Id", l."Naam", g."Naam"
                FROM "Lokalen" l JOIN "Gebouwen" g ON l."GebouwId" = g."Id";
                """);

            migrationBuilder.DropTable(name: "Lokalen");
            migrationBuilder.DropTable(name: "Gebouwen");
            migrationBuilder.RenameTable(name: "LokalenOud", newName: "Lokalen");

            migrationBuilder.CreateIndex(
                name: "IX_Lokalen_Gebouw_Naam",
                table: "Lokalen",
                columns: new[] { "Gebouw", "Naam" },
                unique: true);
        }
    }
}
