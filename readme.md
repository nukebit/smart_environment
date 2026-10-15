# Smart Environment

ASP.NET Core backend with a React, TypeScript, and Tailwind CSS frontend.

Requires **.NET 10 SDK** and **Node.js 22.12+ with npm**.

## Start

Open two terminals from the project folder.

**Backend — terminal 1:**

```bash
cd backend
dotnet run
```

**Frontend — terminal 2:**

```bash
cd frontend
npm install
npm run dev
```

Run `npm install` on first setup or when dependencies change.

Open [http://localhost:5173/login](http://localhost:5173/login).

## Login

- Email: `example@test.com`
- Password: `password`

If the database has no accounts yet, run these commands inside `backend`, then restart the backend:

```bash
dotnet user-secrets set "Auth:InitialUser:Email" "example@test.com"
dotnet user-secrets set "Auth:InitialUser:Password" "password"
```

The account is created at startup and saved in `backend/auth.db`.

## API

Base URL: `http://localhost:5000`.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/auth/csrf` | Get a CSRF token |
| POST | `/api/auth/login` | Log in |
| GET | `/api/auth/me` | Get the logged-in user |
| POST | `/api/auth/logout` | Log out |

Login and logout require a CSRF token. The frontend handles this automatically.

## Stop or restart

Press **Ctrl+C** in each terminal to stop its server.

If port **5000** is already in use, stop the other backend instance before running `dotnet run` again.
