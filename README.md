# JamboCart — Smart Payment Method Selector

JamboCart ranks and presents payment methods dynamically based on customer context (location, device, purchase history, amount, etc.), maximizing conversion at checkout.

## Architecture

```
jambocart-checkout/
├── backend/          # Express API — port 4000
│   ├── src/
│   │   └── index.js  # Entry point
│   ├── .env.example
│   └── package.json
├── frontend/         # Next.js 16 (App Router) — port 3000
│   ├── app/          # Routes & layouts
│   └── package.json
└── README.md
```

### How it works

```
Browser (Next.js :3000)
        │
        │  POST /api/payment-methods  { country, amount, device, ... }
        ▼
Express API (:4000)
        │
        ▼
  Ranking Engine
  ┌─────────────────────────────────────────┐
  │  1. Eligibility filter (country rules)  │
  │  2. Scoring (conversion weights)        │
  │  3. Sorting & deduplication             │
  └─────────────────────────────────────────┘
        │
        ▼
  Ranked method list  →  returned to frontend
```

## Getting started

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev     # nodemon, port 4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev     # Next.js, port 3000
```

### Health check

```bash
curl http://localhost:4000/health
# → { "status": "ok", "service": "jambocart-backend", "port": "4000" }
```

## Tech stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | Next.js 16, TypeScript, Tailwind CSS |
| Backend   | Node 18+, Express 5, CORS, dotenv   |
| Dev tools | nodemon, ESLint                     |
