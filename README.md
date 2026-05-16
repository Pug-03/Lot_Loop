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

Open http://localhost:5173 in two browser tabs (or two machines on the LAN) to simulate two kiosks. Selecting a number on one kiosk locks it on the other in real time.

## Architecture

- **client/** — React + Vite + TypeScript, i18next for TH/EN, Socket.IO client
- **server/** — Node + Express + Socket.IO, in-memory lock store with TTL + pub/sub broadcast

The lock store is a single-file abstraction (`server/src/lockStore.js`). Swap the in-memory implementation for Redis SETNX + Pub/Sub when you need multi-server scaling — the rest of the system doesn't change.

## Hardware stubs

Face scan, ID card reader, ThaID handshake, ticket camera, coin acceptor, and PromptPay payment confirmation are simulated with buttons. Replace each stub with the vendor SDK call when integrating real hardware.
