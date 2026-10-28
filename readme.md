# Smart Environment

Dashboard voor het binnenklimaat van de school.
Backend: **ASP.NET Core Minimal API (C#)** · Frontend: **React + TypeScript + Tailwind CSS** · Database: **SQLite via Entity Framework Core**

## Benodigd

- **.NET 10 SDK**
- **Node.js 22.12+** met npm
- **Git**

---

## Eerste keer instellen

Doe dit één keer op je eigen laptop.

**1. Code ophalen**

```powershell
git clone https://github.com/nukebit/smart_environment.git
cd smart_environment
```

**2. Eerste beheerdersaccount instellen** (in de map `backend`)

```powershell
cd backend
dotnet user-secrets set "Auth:InitialUser:Email" "example@test.com"
dotnet user-secrets set "Auth:InitialUser:Password" "password"
```

Deze gegevens staan in je eigen *user-secrets* op je laptop, niet in Git.
Bij de eerste start maakt de backend hiermee een account met de rol **Beheerder**.

**3. Frontend-pakketten installeren** (in de map `frontend`)

```powershell
cd ..\frontend
npm install
```

---

## Starten

Open **twee terminals** vanuit de projectmap.

**Terminal 1 – backend**

```powershell
cd backend
dotnet run
```

Wacht tot je `Now listening on: http://localhost:5080` ziet.

**Terminal 2 – frontend**

```powershell
cd frontend
npm run dev
```

Open daarna **http://localhost:5173/login**.

| Wat heb je veranderd? | Wat moet je doen? |
|---|---|
| Een bestand in `frontend` (`.tsx`, `.css`) | Niets, de pagina ververst vanzelf |
| Een bestand in `backend` (`.cs`) | Backend herstarten: **Ctrl+C**, daarna `dotnet run` |

Stoppen: druk op **Ctrl+C** in elke terminal.

---

## Inloggen en rollen

Log in met het account uit stap 2 (`example@test.com` / `password`).

| Rol | Ziet | Mag |
|---|---|---|
| **Beheerder** | Dashboard, **Beheer** en **Lokalen** | Accounts en lokalen beheren |
| **Docent** | Dashboard | Gegevens bekijken, geen toegang tot Beheer |

Op **Beheer** (`/beheer`) maakt een beheerder accounts aan voor docenten.
Het wachtwoord dat de beheerder invult, geeft hij persoonlijk door aan de docent.

> De backend controleert de rol bij **elk** verzoek. Een docent die zelf `/api/users` aanroept, krijgt **403**.

---

## Database

De database is één bestand: **`backend/auth.db`** (SQLite).

- **Iedereen heeft een eigen database** op zijn eigen laptop. `auth.db` staat in `.gitignore` en gaat niet naar GitHub.
- **De structuur is voor iedereen gelijk**, want die staat in de map **`backend/Migrations`** (die wél in Git staat).
- Bij `dotnet run` voert de backend de migrations automatisch uit en maakt hij de rollen en het eerste account aan.

### Tabellen bekijken

Installeer in VS Code de extensie **SQLite Viewer** (Florian Klampfer) en klik op `backend/auth.db`.

| Tabel | Inhoud |
|---|---|
| `AspNetUsers` | Accounts: e-mail, wachtwoord-**hash**, `FullName`, `LastLoginAt` (UTC) |
| `AspNetRoles` | De rollen `Beheerder` en `Docent` |
| `AspNetUserRoles` | Welke gebruiker welke rol heeft |
| `Lokalen` | Lokalen: naam en gebouw |
| `__EFMigrationsHistory` | Welke migrations zijn uitgevoerd |

Wijzig niets in de tabellen terwijl de backend draait. Accounts beheer je via de Beheer-pagina.

### Database opnieuw beginnen

Stop de backend en voer in `backend` uit:

```powershell
del auth.db, auth.db-shm, auth.db-wal
dotnet run
```

Een melding dat een bestand niet bestaat, mag je negeren.

### Een nieuwe tabel of kolom toevoegen (migration)

Alleen nodig als je de database-structuur verandert (bijvoorbeeld een nieuw veld in `AppUser.cs`).

```powershell
dotnet tool install --global dotnet-ef        # eenmalig
cd backend
dotnet ef migrations add NaamVanJeWijziging
dotnet run
```

Zet de nieuwe bestanden in `Migrations` mee in je commit.

---

## Lokalen beheren

De pagina **Lokalen** (`/lokalen`) is beschikbaar voor beheerders.
Je kunt het overzicht bekijken, een lokaal toevoegen, de gegevens wijzigen en een lokaal verwijderen.
Een lokaal heeft een naam en een gebouw. Verwijderen vraagt om bevestiging.

De lokalen staan in de tabel **`Lokalen`** in dezelfde **`backend/auth.db`** als de accounts.
Bij het starten voert de backend de migration **`AddLokalen`** automatisch uit.
Bij het openen van de pagina worden de lokalen uit deze database ingeladen.
Toevoegen, wijzigen en verwijderen worden direct in SQLite opgeslagen en blijven na een herstart bewaard.
Alle beheerders op dezelfde backend zien hetzelfde overzicht. Iedere laptop heeft zijn eigen database.
De tabel begint leeg; voeg via de pagina de lokalen van je school toe.

De backend en de frontend-proxy gebruiken poort **5080**; op macOS kan poort 5000 al bezet zijn.

---

## API

Base URL: `http://localhost:5080`. De frontend gebruikt `/api/...`; Vite stuurt dat door naar de backend.

Verzoeken die iets veranderen (**POST, PUT, DELETE**) hebben een CSRF-token nodig in de header `X-CSRF-TOKEN`. Haal die op met `GET /api/auth/csrf`. De frontend regelt dit zelf.

### Inloggen – `backend/Auth/AuthEndpoints.cs`

| Method | Route | Toegang | Doel |
|---|---|---|---|
| GET | `/api/auth/csrf` | iedereen | CSRF-token ophalen |
| POST | `/api/auth/login` | iedereen | Inloggen (max. 20 pogingen per minuut, na 5 foute pogingen 5 min. geblokkeerd) |
| GET | `/api/auth/me` | ingelogd | Gegevens en rol van de ingelogde gebruiker |
| POST | `/api/auth/logout` | ingelogd | Uitloggen |

### Gebruikersbeheer – `backend/Users/UserEndpoints.cs`

| Method | Route | Toegang | Doel |
|---|---|---|---|
| GET | `/api/users` | Beheerder | Alle accounts |
| POST | `/api/users` | Beheerder | Account aanmaken (`fullName`, `email`, `role`, `password`) |
| PUT | `/api/users/{id}` | Beheerder | Naam, e-mail en rol wijzigen |
| DELETE | `/api/users/{id}` | Beheerder | Account verwijderen (niet je eigen account) |

### Lokaalbeheer – `backend/Lokalen/LokaalEndpoints.cs`

Alle routes vereisen de rol **Beheerder**. POST, PUT en DELETE vereisen ook een CSRF-token.

| Method | Route | Doel |
|---|---|---|
| GET | `/api/lokalen` | Lokalen uit SQLite laden |
| GET | `/api/lokalen/{id}` | Eén lokaal bekijken |
| POST | `/api/lokalen` | Lokaal toevoegen (`naam`, `gebouw`) |
| PUT | `/api/lokalen/{id}` | Lokaalgegevens wijzigen |
| DELETE | `/api/lokalen/{id}` | Lokaal verwijderen |

Een lokaalnaam is uniek binnen een gebouw (hoofdletters maken geen verschil).
Dubbele invoer geeft **409**; ongeldige invoer geeft **400**.

Statuscodes: **401** = niet ingelogd · **403** = geen rechten · **400** = ongeldige invoer of CSRF-token.

---

## Projectstructuur

```
smart_environment/
├── backend/
│   ├── Auth/            Inloggen: endpoints, instellingen (cookies, CSRF, lockout)
│   ├── Common/          Gedeelde hulpfuncties voor alle endpoints (CSRF, validatie, foutmeldingen)
│   ├── Data/            Database: AppUser, Roles, AuthDbContext, opstarten van de database
│   ├── Migrations/      Bouwplan van de database (gemaakt door EF Core, niet zelf aanpassen)
│   ├── Users/           Gebruikersbeheer (CRUD) voor de Beheerder
│   ├── appsettings.json Verbinding met de database
│   └── Program.cs       Start de server en koppelt alle onderdelen
└── frontend/
    ├── public/          Logo en andere afbeeldingen
    └── src/
        ├── components/  Stukken die op meerdere pagina's terugkomen (AppHeader)
        ├── hooks/       Herbruikbare logica (useDarkMode)
        ├── pages/       Eén bestand per pagina: LoginPage, DashboardPage, BeheerPage
        ├── index.css    Tailwind en eigen kleuren
        └── main.tsx     Kiest de pagina op basis van de URL
```

Nieuwe onderdelen (bijvoorbeeld sensordata) krijgen in `backend` een eigen map, zoals `Sensors/`, en in `frontend/src/pages` een eigen pagina.

---

## Samenwerken met Git

- Werk nooit direct op `master`. Maak een eigen branch:

```powershell
  git switch master
  git pull
  git switch -c JouwNaam-onderwerp
```

- Sla je werk op:

```powershell
  git add .
  git commit -m "Korte beschrijving"
  git push
```

- Klaar? Maak een **Pull Request** naar `master` en laat een groepsgenoot het nakijken.

---

## Geheimen

Zet **nooit** wachtwoorden of API-keys in de code, in `appsettings.json` of in Git.
Gebruik `dotnet user-secrets` in de map `backend`, zoals bij het eerste account.

Voor de Urban Sense API (sensordata, nog niet gekoppeld):

```powershell
dotnet user-secrets set "UrbanSense:BaseUrl" "https://urban-sense-api.azure-api.net/urban-sense"
dotnet user-secrets set "UrbanSense:ApiKey" "KEY-UIT-DE-MAIL-VAN-DE-DOCENT"
```

---

## Problemen oplossen

| Probleem | Oplossing |
|---|---|
| `npm.ps1 cannot be loaded because running scripts is disabled` | Eenmalig: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, of gebruik `npm.cmd` |
| Inloggen lukt niet (401) met het juiste wachtwoord | Controleer de user-secrets (stap 2), verwijder `auth.db` en start de backend opnieuw |
| Backend start niet: `table "AspNetUsers" already exists` | Je hebt een oude database van vóór de migrations. Maak eerst een back-up en werk het schema bij met behoud van accounts |
| `Port 5080 is already in use` | Er draait al een backend. Stop die met **Ctrl+C** of sluit de oude terminal |
| `/api/...` geeft 401 terwijl je ingelogd bent | Je hebt de link vanuit een andere site geopend. **Typ** het adres zelf in de adresbalk (de cookie is `SameSite=Strict`) |
| `dotnet ef` wordt niet herkend | Na `dotnet tool install --global dotnet-ef` de terminal sluiten en een nieuwe openen |
