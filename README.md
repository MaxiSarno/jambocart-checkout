# JamboCart — Smart Payment Method Selector

## Overview
JamboCart is a checkout engine that ranks payment methods in real time based on customer context — country, device, purchase amount, and history. Instead of showing every available method in a fixed order, it surfaces the right option first, maximising authorisation rates and reducing checkout abandonment.

## Tech Stack
- Frontend: Next.js 14, TypeScript, Tailwind CSS (port 3000)
- Backend: Node.js, Express (port 4000)

## Setup & Running

### Prerequisites
- Node.js 18+
- npm

### Installation
```bash
# Clone and enter project
cd jambocart-checkout

# Install backend
cd backend && npm install

# Install frontend
cd ../frontend && npm install
```

### Running
```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open http://localhost:3000

## API Endpoints

### POST /api/rank
Ranks payment methods based on customer context.

Request body:
```json
{
  "country": "KE",
  "currency": "KES",
  "deviceType": "mobile",
  "amountUSD": 150,
  "isReturning": false,
  "previousMethodId": "",
  "customerAge": "18-25"
}
```

Response:
```json
{
  "ranked": [
    {
      "rank": 1,
      "id": "lipa_later",
      "name": "Lipa Later",
      "score": 91,
      "confidence": 76,
      "reasons": [
        "Installments available for this amount",
        "Popular with your age group",
        "Popular in KE",
        "76% approval rate"
      ]
    }
  ]
}
```

### GET /api/methods
Returns all 12 payment methods with metadata.

## Test Scenarios
Three quick-test scenarios are available in the UI:
- 🇰🇪 Nairobi mobile shopper → M-PESA #1
- 🌍 International buyer → Visa/Mastercard #1
- 🎓 Student installments → Lipa Later #1

## Project Structure
```
jambocart-checkout/
├── backend/
│   ├── data/
│   │   ├── paymentMethods.js   # 12 payment methods with metadata
│   │   └── transactions.js     # 150 mock transactions
│   ├── engine/
│   │   └── ranker.js           # Core ranking logic (5 signals)
│   ├── routes/
│   │   └── payments.js         # API routes
│   └── index.js
└── frontend/
    ├── src/
    │   ├── app/
    │   │   └── page.tsx        # Main checkout page
    │   ├── components/
    │   │   ├── ContextForm.tsx      # Customer context form
    │   │   ├── PaymentCard.tsx      # Individual method card
    │   │   └── RankingResults.tsx   # Ranked results display
    │   ├── lib/
    │   │   └── api.ts          # Backend API calls
    │   └── types/
    │       └── payment.ts      # TypeScript interfaces
    └── ...
```
