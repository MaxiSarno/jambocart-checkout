# Technical Write-up — JamboCart Smart Payment Selector

## Ranking Algorithm

The core of JamboCart is a deterministic, multi-signal scoring engine
in `backend/engine/ranker.js`. Every payment method starts at 0 points
and accumulates score based on five independent signals:

### Signal 1 — Geographic match (up to +45 pts)
Methods that natively support the customer's country score +30 points.
Methods that don't support the customer's country OR currency are
immediately excluded (score = -1) and never shown to the user.
This is the hard filter — showing an unavailable method is worse than
showing no method at all.

Cards (Visa, Mastercard) receive an additional +15 points when the
customer's country is outside the core African markets (KE, UG, TZ,
GH, CM), reflecting their dominant role in international e-commerce.

### Signal 2 — Historical preference (up to +50 pts)
For returning customers, their previously used method gets +50 points —
the highest single-signal bonus in the system. This is intentional:
familiarity reduces friction and increases conversion more reliably
than any algorithmic guess. If the customer is returning but the exact
previous method is unknown, any method with more than 10 approved
transactions in that country gets +15 points as a regional popularity
signal derived from the transaction history.

### Signal 3 — Device affinity (up to +20 pts)
Methods marked `popularOnMobile` receive +20 points on mobile devices.
Cards receive +10 points on desktop, where form-filling is less
friction-heavy. This reflects real-world behaviour: mobile money (M-PESA,
Airtel) converts better on phones; SEPA-style bank transfers and card
entry convert better on desktop.

### Signal 4 — Amount fit (up to +35 pts, or exclusion)
Amount is the only signal that can both exclude a method and add points:

- **Hard exclusion**: if `amountUSD < method.minAmount` or
  `amountUSD > method.maxAmount`, the method is dropped entirely.
- **BNPL boost**: BNPL methods (Lipa Later, Aspira) get +25 pts when
  `amountUSD >= $100`, because instalments are only meaningful on
  non-trivial purchases. An extra +10 pts applies for the 18–25 age
  group, matching the demographic that most actively uses BNPL.
- **Small-amount boost**: mobile money and wallets get +10 pts when
  `amountUSD < $50`, where their zero-fee, instant nature is most
  competitive against card fees.

### Signal 4b — Processing speed (−20 to +5 pts)
A fast checkout is a better checkout. Methods that settle in ≤10 seconds
(Visa, Mastercard, PayPal) get +5 pts. Methods that take more than one
hour to settle (SWIFT: 2 days) are penalised −20 pts when the amount
is below $1,000 — the rationale being that a buyer purchasing a $250
item does not want to wait 48 hours for confirmation. For large transfers
(≥$1,000) the penalty is waived, since SWIFT is genuinely the right
tool for high-value international wires.

### Signal 5 — Historical authorisation rate (variable pts)
Each method carries an `authRate` derived from real network benchmarks.
The bonus is `Math.round((authRate - 0.70) * 100)`, so only methods
above a 70% floor contribute positive points. M-PESA at 94% scores
+24 pts; OXXO at 76% scores +6 pts. This keeps low-performing methods
from ranking above faster, more reliable alternatives.

---

## Confidence Score
The `confidence` field exposed in the API is not a raw probability —
it is a normalised display metric: `min(100, Math.round(score / 120 * 100))`.
The denominator of 120 represents the approximate ceiling of a well-matched
method (geographic + device + amount + speed + auth rate, without the
returning-customer bonus). It gives the frontend a 0–100 value suitable
for a progress bar without exposing raw points to the client.

---

## Data Layer

### Payment Methods (`backend/data/paymentMethods.js`)
Twelve methods covering the major payment archetypes present in East
Africa and globally: mobile money, card networks, BNPL, bank transfers,
digital wallets, and aggregators. Each method carries:

| Field | Purpose |
|---|---|
| `countries` / `currencies` | Eligibility scope. `["*"]` means global acceptance. |
| `authRate` | Expected approval probability (used in Signal 5). |
| `avgProcessingSeconds` | Settlement latency (used in Signal 4b). |
| `minAmount` / `maxAmount` | Hard amount eligibility bounds. |
| `popularOnMobile` | Device affinity flag (used in Signal 3). |

### Mock Transactions (`backend/data/transactions.js`)
150 programmatically generated transactions over a 90-day window,
with a realistic distribution:
- **60% Kenya, 15% Uganda, 10% Tanzania, 15% international** — mirrors
  the primary target market.
- **~70% mobile, ~30% desktop** — weighted by each method's
  `popularOnMobile` flag.
- **Status driven by `authRate`** — M-PESA generates ~94% approved;
  cards generate ~82%. This makes the historical signal (Signal 2)
  meaningful rather than synthetic.

The generator lives at `backend/scripts/generateTransactions.js` and
can be re-run at any time to produce a fresh dataset.

---

## Design Decisions

### Why points instead of probabilities?
A probability model requires training data and risks being opaque to
product teams. A points-based system is auditable: every point has a
named reason, and those reasons are returned to the frontend verbatim.
When a payment method ranks unexpectedly, the `reasons` array shows
exactly why.

### Why is "returning customer" the strongest signal?
Friction is the enemy of checkout conversion. A returning customer who
already trusts a method is far more likely to complete the purchase if
that method appears first. The 50-point bonus is deliberately large
enough to override other signals — the engine won't demote M-PESA to
#3 just because the amount would marginally favour a card.

### Why exclude rather than penalise for geographic mismatch?
Showing a method that cannot process the transaction (wrong country or
currency) is a UX failure that erodes trust. A -30 penalty still allows
the method to appear; an exclusion guarantees it cannot. The only
acceptable ranking position for an ineligible method is "not shown".

### Why hard-code African countries in the international card boost?
The boost targets the specific gap where card networks underperform
local alternatives inside Africa (M-PESA, MTN MoMo, PesaLink) but
dominate everywhere else. Parameterising this list is straightforward
if the market scope expands — the constant `AFRICAN_COUNTRIES` in
`ranker.js` is the single place to update.

---

## Extending the Engine

Adding a new signal requires three steps:

1. Write a `signalX(method, context)` function that returns
   `{ points: number, reasons: string[] }` (or `null` to exclude).
2. Call it inside the `rankPaymentMethods` loop and add its points to
   `score` and its reasons to the `reasons` array.
3. Update this document.

No other files need to change. The frontend consumes `score`,
`confidence`, and `reasons` without knowledge of how they are computed.
