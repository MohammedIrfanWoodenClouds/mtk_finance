# MTK Finance

Personal finance management platform with ledger-based accounting, custom JWT auth, and a unified Next.js + FastAPI app deployable on Vercel.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React, Tailwind CSS, Zustand, TanStack Query, ApexCharts |
| API | FastAPI, SQLAlchemy, Alembic, Pydantic (`server/`) |
| Database | PostgreSQL (Supabase) |
| Deploy | Vercel (Next.js + Python serverless) |

## Project structure

```text
mtk_finance/
├── src/                 # Next.js UI (App Router)
├── server/app/          # FastAPI + ledger engine
├── public/
├── alembic/             # Database migrations
├── tests/
├── .env                 # Single env file (frontend + API)
├── package.json
├── requirements.txt
└── vercel.json
```

## Prerequisites

- Node.js 20+
- Python 3.12+
- Supabase project with PostgreSQL enabled

## Environment

```bash
cp .env.example .env
```

One [`.env`](.env) at the repo root — used by **Next.js** and **FastAPI**.

### Default login (single user)

| Field | Value |
|-------|--------|
| Email | `admin@mtkfin.com` |
| Password | `pass123` |

Created automatically on API startup. Change password in **Settings** after login.

Registration is disabled.

## Local development

### 1. Install dependencies

```bash
npm install
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

### 2. Configure Supabase `DATABASE_URL`

In Supabase Dashboard → **Project Settings** → **Database** → **Connection string**, copy the **Session pooler** URI into `.env` as `DATABASE_URL` (use `postgresql+psycopg://` prefix).

Test connection:

```bash
npm run db:check
```

### 3. Run migrations

```bash
npm run db:migrate
```

### 4. Start dev

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| App | http://localhost:3000 |
| API (direct) | http://localhost:8000/api/docs |
| API (proxied) | http://localhost:3000/api/v1/... |

**Troubleshooting:** If API routes return 404 but code looks correct, an old `uvicorn` may still be bound to port 8000 (often system Python without `PYTHONPATH=server`). Stop all dev servers, then on Windows run `Get-NetTCPConnection -LocalPort 8000` and end stray `python`/`uvicorn` processes before `npm run dev` again.

**AI assistant:** Uses `GEMINI_API_KEY` with optional `GEMINI_API_KEY2` fallback (ideally from a **different** Google Cloud project — quotas are per project). Global + per-user rate limits protect quota; failed keys enter cooldown before reuse. If you see *quota exhausted*, enable billing in [Google AI Studio](https://aistudio.google.com/apikey) or add a second project key.

## Vercel deployment

1. Import repo — **Root Directory:** `.` (repository root)
2. Add env vars from [`.env.example`](.env.example) in Vercel dashboard
3. Deploy — `vercel.json` routes `/api/v1/*` → `server/app/api/index.py`
4. Run `npm run db:migrate` locally against production `DATABASE_URL`

**Production URLs:** set `SITE_URL` and `NEXT_PUBLIC_API_URL` to your `https://*.vercel.app` URL.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js + FastAPI |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply migrations |
| `npm run db:revision` | New migration |

## Gmail email (Nodemailer)

1. Enable 2-Step Verification on your Google account
2. Create an **App Password**: https://myaccount.google.com/apppasswords (Mail → Other → MTK Finance)
3. Add to `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM=your.email@gmail.com
EMAIL_INTERNAL_SECRET=any-random-long-string
```

Use the same `EMAIL_INTERNAL_SECRET` value in `.env` (Next and FastAPI both read the root file).

4. Restart `npm run dev`
5. Test: **Login** → **Forgot password?** → enter `admin@mtkfin.com`

## Finance Assistant (AI)

1. Get a key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Add to `.env`: `GEMINI_API_KEY=your-key`
3. Open **Assistant** in the app sidebar

The assistant reads your accounts and transactions (advisory only — never changes balances).

## License

Private — personal use.
