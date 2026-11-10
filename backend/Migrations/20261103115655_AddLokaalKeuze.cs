using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartEnvironment.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLokaalKeuze : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LokaalKeuzes",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    LokaalId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LokaalKeuzes", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_LokaalKeuzes_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LokaalKeuzes_Lokalen_LokaalId",
                        column: x => x.LokaalId,
                        principalTable: "Lokalen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LokaalKeuzes_LokaalId",
                table: "LokaalKeuzes",
                column: "LokaalId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LokaalKeuzes");
        }
    }
}
