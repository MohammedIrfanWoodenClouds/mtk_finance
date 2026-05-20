# MTK Finance

Personal finance management with ledger-based accounting, JWT auth, and a unified Next.js + FastAPI app on Vercel.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React, Tailwind CSS, Zustand, TanStack Query, ApexCharts |
| API | FastAPI, SQLAlchemy, Alembic (`server/`) |
| Database | PostgreSQL (Supabase) |
| Deploy | Vercel |

## Structure

```text
mtk_finance/
├── src/              # Next.js App Router
├── server/app/       # FastAPI + ledger
├── alembic/          # Migrations
├── scripts/          # dev-api.ps1, db_check.py
├── .env              # Local secrets (gitignored)
└── vercel.json
```

## Local setup

```bash
cp .env.example .env
npm install
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
npm run db:migrate
npm run dev
```

| Service | URL |
|---------|-----|
| App | http://localhost:3000 |
| API docs (local only) | http://localhost:8000/api/docs |

Default admin (seeded on API startup): `admin@mtkfin.com` / `pass123` — change in **Settings** after login.

## Production deployment (Vercel)

1. Import repo (root directory `.`).
2. Set **Environment variables** in Vercel (from `.env.example`):

| Variable | Required | Notes |
|----------|----------|--------|
| `ENVIRONMENT` | Yes | `production` |
| `DATABASE_URL` | Yes | Supabase pooler URI |
| `JWT_SECRET_KEY` / `JWT_REFRESH_SECRET_KEY` | Yes | Strong random strings |
| `SITE_URL` | Yes | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_API_URL` | Yes | Same as `SITE_URL` |
| `BACKEND_CORS_ORIGINS` | Yes | Same as `SITE_URL` |
| `GEMINI_API_KEY` | For AI | Optional `GEMINI_API_KEY2` |
| `SMTP_*` + `MAIL_TO` | For email | Gmail app password |
| `EMAIL_INTERNAL_SECRET` | For email | Random secret (Next ↔ API) |

3. Deploy. Run migrations against production DB:

```bash
npm run db:migrate
```

4. Verify: `GET https://your-app.vercel.app/api/health`

**Production behavior**

- OpenAPI docs disabled (`ENVIRONMENT` ≠ `local`)
- Registration disabled; single admin user
- Password-reset emails go to `MAIL_TO`
- No dev test scripts or stub API routes

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js + FastAPI |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply migrations |
| `npm run db:check` | Test database connection |

## Email (SMTP + MAIL_TO)

All outbound mail is delivered to `MAIL_TO`. Configure Gmail app password in `.env` (see `.env.example`). Password reset: **Forgot password** on login.

## Finance Assistant

Set `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-flash-latest` in `.env`. Optional `GEMINI_API_KEY2` from another Google Cloud project.

## License

Private — personal use.
