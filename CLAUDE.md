# JamboCart — Smart Payment Selector

## Stack
- Frontend: Next.js 14, TypeScript, Tailwind — puerto 3000
- Backend: Node/Express — puerto 4000
- No database, todo en memoria con mock data

## Estructura
/backend → Express API
/frontend → Next.js app

## Reglas
- El ranking engine vive SOLO en backend/engine/ranker.js
- El frontend nunca calcula rankings, solo consume el API
- Cada método de pago tiene: id, name, type, countries, currencies, authRate
