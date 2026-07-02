# Lottery Kiosk / ตู้จำหน่ายสลากอัตโนมัติ

Bilingual (TH/EN) lottery vending machine kiosk app with real-time distributed locking.

แอปตู้จำหน่ายสลากอัตโนมัติสองภาษา (ไทย/อังกฤษ) พร้อมระบบล็อกแบบกระจายตัวแบบเรียลไทม์

## Run / การเรียกใช้งาน

Two terminals: / เปิดสองเทอร์มินัล:

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

เปิด http://localhost:5173 ในเบราว์เซอร์สองแท็บ (หรือสองเครื่องในวง LAN เดียวกัน) เพื่อจำลองตู้สองตู้ การเลือกเลขที่ตู้หนึ่งจะล็อกเลขนั้นที่อีกตู้แบบเรียลไทม์ทันที

## Architecture / สถาปัตยกรรม

- **client/** — React + Vite + TypeScript, i18next for TH/EN, Socket.IO client
- **server/** — Node + Express + Socket.IO, in-memory lock store with TTL + pub/sub broadcast

<!-- -->

- **client/** — React + Vite + TypeScript, ใช้ i18next สำหรับไทย/อังกฤษ, Socket.IO client
- **server/** — Node + Express + Socket.IO, ที่เก็บล็อกในหน่วยความจำพร้อม TTL + การกระจายข่าวแบบ pub/sub

The lock store is a single-file abstraction (`server/src/lockStore.js`). Swap the in-memory implementation for Redis SETNX + Pub/Sub when you need multi-server scaling — the rest of the system doesn't change.

ที่เก็บล็อกถูกแยกเป็นไฟล์เดียว (`server/src/lockStore.js`) หากต้องการขยายไปหลายเซิร์ฟเวอร์ ให้เปลี่ยนจากแบบในหน่วยความจำไปใช้ Redis SETNX + Pub/Sub ได้เลย โดยส่วนอื่นของระบบไม่ต้องแก้ไข

## How it works / หลักการทำงาน

Customers walk through a 4-step flow in order (see the `Stepper` at the top of the screen). All state is **per-session** — held only in the browser's memory. A page refresh or leaving the screen idle until it times out (`IdleReset`) clears the session and starts a new customer.

ลูกค้าเดินผ่าน flow 4 ขั้นตอนตามลำดับ (ดูแถบ `Stepper` ด้านบนจอ) โดยสถานะทั้งหมดเป็น **per-session** — เก็บในหน่วยความจำของเบราว์เซอร์เท่านั้น การรีเฟรชหรือปล่อยจอทิ้งไว้จนหมดเวลา (`IdleReset`) จะล้าง session แล้วเริ่มลูกค้าคนใหม่

1. **Identity (`/identity`)** — PDPA consent (`ConsentModal`) is required before anything else; until it's given, every page redirects back here. Then verify identity by Thai ID card or ThaID, and scan the face against the ID photo.
2. **Recycle old ticket (`/recycle`)** — If the customer brings an old ticket to trade in, they get a **5 THB discount**, and the old ticket's number is auto pre-selected in the next step (if still free).
3. **Select numbers (`/select`)** — Pick one at a time (single) or a set of 5 (set) from trending numbers, a direct 6-digit search, or a random draw. Tapping a number **temporarily locks** it immediately.
4. **Payment (`/payment`)** — 80 THB per ticket minus any old-ticket discount, paid by coin/note or PromptPay. Once payment is confirmed, the ticket is printed and the sale is finalized permanently.

<!-- -->

1. **ยืนยันตัวตน (`/identity`)** — ต้องรับความยินยอม PDPA (`ConsentModal`) ก่อนทำอะไรทั้งสิ้น หากยังไม่ยินยอม ทุกหน้าจะถูกส่งกลับมาหน้านี้ จากนั้นยืนยันตัวตนด้วยบัตรประชาชนหรือ ThaID แล้วสแกนใบหน้าเทียบกับรูปในบัตร
2. **แลกตั๋วเก่า (`/recycle`)** — ถ้าลูกค้านำตั๋วใบเก่ามาแลก จะได้ **ส่วนลด 5 บาท** และเลขของตั๋วเก่าจะถูกนำไป pre-select ให้อัตโนมัติในขั้นถัดไป (หากยังว่างอยู่)
3. **เลือกเลข (`/select`)** — เลือกได้ทั้งแบบทีละใบ (single) หรือชุด 5 ใบ (set) จากเลขยอดนิยม (trending) การค้นหาเลข 6 หลักโดยตรง หรือการสุ่ม การกดเลือกเลขจะ **จองชั่วคราว (lock)** เลขนั้นทันที
4. **ชำระเงิน (`/payment`)** — ราคาใบละ **80 บาท** หักส่วนลดตั๋วเก่า จ่ายผ่านเหรียญ/ธนบัตร หรือ PromptPay เมื่อยืนยันการจ่ายสำเร็จจึงพิมพ์ตั๋วและปิดการขายอย่างถาวร

### Distributed locking & real-time sync / การล็อกแบบกระจายและการซิงก์เรียลไทม์

- Every kiosk connects to the server over **Socket.IO**. On connect it receives a `snapshot` (trending numbers, current locks, sold numbers, TTL value) so all machines share the same state.
- Selecting a number sends `lock:acquire` to reserve it on the server. A lock lives for **90 seconds (TTL)** and the server sweeps expired locks every 5 seconds. On lock/unlock/expiry the server broadcasts `lock:update` to every kiosk — a number held by another machine shows as "unavailable" instantly.
- Deselecting, or ending the session (disconnect), releases all held locks back to the system.

<!-- -->

- ทุก kiosk เชื่อมกับเซิร์ฟเวอร์ผ่าน **Socket.IO** เมื่อต่อสำเร็จจะได้ `snapshot` (เลขยอดนิยม, รายการล็อกปัจจุบัน, เลขที่ขายแล้ว, ค่า TTL) เพื่อให้ทุกเครื่องเห็นสถานะตรงกัน
- การกดเลือกเลขจะส่ง `lock:acquire` ไปจองที่เซิร์ฟเวอร์ การจองมีอายุ **90 วินาที (TTL)** และเซิร์ฟเวอร์กวาดล้างล็อกที่หมดอายุทุก 5 วินาที เมื่อล็อก/ปลดล็อก/หมดอายุ เซิร์ฟเวอร์จะ broadcast `lock:update` ให้ทุก kiosk — เลขที่ถูกเครื่องอื่นจองจะขึ้นสถานะ "ไม่ว่าง" ทันที
- ยกเลิกการเลือก หรือปิด session (disconnect) จะปล่อยล็อกที่ถืออยู่ทั้งหมดคืนสู่ระบบ

### Selling & sold numbers / การขายและเลขที่ขายไปแล้ว

- Confirming payment sends `purchase`, which is **atomic** — if any number is already sold or held by another kiosk, nothing is sold at all (returns `reason: "unavailable"`).
- Sold numbers are removed from the system permanently, persisted to `server/data/sold.json` (file location configurable via the `SOLD_FILE` env var) so they survive a restart, and broadcast as `sold:update` to every kiosk so they're never offered again.

<!-- -->

- การกดจ่ายสำเร็จจะส่ง `purchase` ซึ่งทำงานแบบ **atomic** — ถ้ามีเลขใดถูกขายไปแล้วหรือถูก kiosk อื่นถือครองอยู่ จะไม่ขายเลขใดเลย (คืน `reason: "unavailable"`)
- เลขที่ขายแล้วถูกลบออกจากระบบถาวร บันทึกลง `server/data/sold.json` (ตั้งค่าที่ตั้งไฟล์ได้ด้วย env `SOLD_FILE`) จึงอยู่รอดแม้เซิร์ฟเวอร์รีสตาร์ต และ broadcast `sold:update` ให้ทุก kiosk เพื่อไม่ให้ถูกเสนอขายซ้ำ

## Numbers and sold-out handling / เลขและการจัดการเลขที่ขายหมด

- The full range **000000–999999** is sellable. Any 6-digit number can be searched or selected directly — there is no fixed catalogue.
- Selecting a number places a temporary 90s **hold** (lock) so two kiosks can't take it at once.
- Completing payment **permanently sells** the number: it is removed from the system and never offered again. Sold numbers are persisted to `server/data/sold.json` (configurable via the `SOLD_FILE` env var) so they survive a server restart. Swap this JSON file for your authoritative DB/Redis set behind the same `soldStore` surface for production.
- A sold number is broadcast (`sold:update`) to every kiosk in real time, and the server rejects any later attempt to lock or buy it (`reason: "sold"`).

<!-- -->

- ทั้งช่วง **000000–999999** ขายได้ทั้งหมด สามารถค้นหาหรือเลือกเลข 6 หลักใดก็ได้โดยตรง — ไม่มีแคตตาล็อกตายตัว
- การเลือกเลขจะวาง **การจองชั่วคราว (lock) 90 วินาที** เพื่อกันไม่ให้สองตู้หยิบเลขเดียวกันพร้อมกัน
- การชำระเงินสำเร็จจะ **ขายเลขนั้นอย่างถาวร** โดยลบออกจากระบบและไม่นำมาเสนอขายอีก เลขที่ขายแล้วถูกบันทึกลง `server/data/sold.json` (ตั้งค่าได้ด้วย env `SOLD_FILE`) จึงอยู่รอดแม้เซิร์ฟเวอร์รีสตาร์ต สำหรับใช้งานจริง ให้เปลี่ยนไฟล์ JSON นี้เป็นฐานข้อมูล/Redis ที่เป็นแหล่งข้อมูลหลักภายใต้อินเทอร์เฟซ `soldStore` เดิม
- เลขที่ขายแล้วจะถูก broadcast (`sold:update`) ไปยังทุกตู้แบบเรียลไทม์ และเซิร์ฟเวอร์จะปฏิเสธความพยายามล็อกหรือซื้อเลขนั้นภายหลัง (`reason: "sold"`)

## Hardware integration / การเชื่อมต่อฮาร์ดแวร์

Face scan, ID card reader, ThaID handshake, ticket camera, coin acceptor, and PromptPay payment confirmation are each driven from a single on-screen action in the flow. Wire each one to its device by replacing that action's handler with the vendor SDK call:

การสแกนใบหน้า, เครื่องอ่านบัตรประชาชน, การเชื่อมต่อ ThaID, กล้องสแกนตั๋ว, เครื่องรับเหรียญ และการยืนยันชำระเงิน PromptPay ต่างถูกสั่งงานจากปุ่ม/แอ็กชันเดียวบนจอในแต่ละขั้นของ flow เชื่อมต่อกับอุปกรณ์จริงได้โดยแทนที่ handler ของแอ็กชันนั้นด้วยการเรียก SDK ของผู้ผลิต:

| Capability / ความสามารถ | Where / ตำแหน่งในโค้ด | Needs to go live / สิ่งที่ต้องมีเพื่อใช้งานจริง |
| --- | --- | --- |
| ID card reader / เครื่องอ่านบัตรประชาชน | `Page1Identity.tsx` → `handleAck` (card step) | PC/SC smart-card reader + APDU read of the Thai ID chip / เครื่องอ่านบัตร PC/SC + อ่านชิปบัตรผ่าน APDU |
| ThaID | `Page1Identity.tsx` → `handleAck` (ThaID step) | ThaID OpenID/partner API credentials / ข้อมูลรับรอง API ของ ThaID (OpenID/พาร์ทเนอร์) |
| Face verification / ยืนยันใบหน้า | `Page1Identity.tsx` → `handleFaceOk` | Camera + face-match SDK (1:1 against the ID photo) / กล้อง + SDK เทียบใบหน้า (1:1 กับรูปในบัตร) |
| Old-ticket scanner / สแกนตั๋วเก่า | `Page2Recycle.tsx` → `captureTicket` | Ticket camera/OCR or barcode read of the old ticket / กล้อง/OCR หรืออ่านบาร์โค้ดของตั๋วเก่า |
| Coin/note acceptor / เครื่องรับเหรียญ-ธนบัตร | `Page4Payment.tsx` → `insert()` | Acceptor hardware events (ccTalk/serial) driving the credited amount / อีเวนต์ฮาร์ดแวร์ (ccTalk/serial) ที่ส่งยอดเงินที่รับเข้ามา |
| PromptPay | `Page4Payment.tsx` → `PromptPayQR` + `completePayment` | Merchant PromptPay payload + bank webhook to confirm the transfer before printing / เพย์โหลด PromptPay ของร้านค้า + webhook ธนาคารยืนยันการโอนก่อนพิมพ์ตั๋ว |
| Ticket printer / เครื่องพิมพ์ตั๋ว | `Page4Payment.tsx` → `completePayment` | Thermal printer SDK / SDK เครื่องพิมพ์ความร้อน |

The number selection, distributed locking, pricing, discount, and bilingual flow are fully functional today.

ส่วนการเลือกเลข, การล็อกแบบกระจาย, การคิดราคา, ส่วนลด และ flow สองภาษา ทำงานได้ครบสมบูรณ์แล้วในปัจจุบัน
