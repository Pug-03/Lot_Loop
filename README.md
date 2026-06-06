# Lottery Kiosk

Bilingual (TH/EN) lottery vending machine kiosk app with real-time distributed locking.

## Run

Two terminals:

```bash
# Terminal 1 - server (port 4000)
cd server
npm install
npm run dev

# Terminal 2 - client (port 5173)
cd client
npm install
npm run dev
```

Open http://localhost:5173 in two browser tabs (or two machines on the LAN) to run two kiosks. Selecting a number on one kiosk locks it on the other in real time.

## Architecture

- **client/** — React + Vite + TypeScript, i18next for TH/EN, Socket.IO client
- **server/** — Node + Express + Socket.IO, in-memory lock store with TTL + pub/sub broadcast

The lock store is a single-file abstraction (`server/src/lockStore.js`). Swap the in-memory implementation for Redis SETNX + Pub/Sub when you need multi-server scaling — the rest of the system doesn't change.

## Numbers and sold-out handling

- The full range **000000–999999** is sellable. Any 6-digit number can be searched or selected directly — there is no fixed catalogue.
- Selecting a number places a temporary 90s **hold** (lock) so two kiosks can't take it at once.
- Completing payment **permanently sells** the number: it is removed from the system and never offered again. Sold numbers are persisted to `server/data/sold.json` (configurable via the `SOLD_FILE` env var) so they survive a server restart. Swap this JSON file for your authoritative DB/Redis set behind the same `soldStore` surface for production.
- A sold number is broadcast (`sold:update`) to every kiosk in real time, and the server rejects any later attempt to lock or buy it (`reason: "sold"`).

## Hardware integration

Face scan, ID card reader, ThaID handshake, ticket camera, coin acceptor, and PromptPay payment confirmation are each driven from a single on-screen action in the flow. Wire each one to its device by replacing that action's handler with the vendor SDK call:

| Capability | Where | Needs to go live |
| --- | --- | --- |
| ID card reader | `Page1Identity.tsx` → `handleAck` (card step) | PC/SC smart-card reader + APDU read of the Thai ID chip |
| ThaID | `Page1Identity.tsx` → `handleAck` (ThaID step) | ThaID OpenID/partner API credentials |
| Face verification | `Page1Identity.tsx` → `handleFaceOk` | Camera + face-match SDK (1:1 against the ID photo) |
| Old-ticket scanner | `Page2Recycle.tsx` → `captureTicket` | Ticket camera/OCR or barcode read of the old ticket |
| Coin/note acceptor | `Page4Payment.tsx` → `insert()` | Acceptor hardware events (ccTalk/serial) driving the credited amount |
| PromptPay | `Page4Payment.tsx` → `PromptPayQR` + `completePayment` | Merchant PromptPay payload + bank webhook to confirm the transfer before printing |
| Ticket printer | `Page4Payment.tsx` → `completePayment` | Thermal printer SDK |

The number selection, distributed locking, pricing, discount, and bilingual flow are fully functional today.
