// Smoke test: two simulated kiosks, verify locks broadcast and exclude correctly.
import { io } from "socket.io-client";

const A = io("http://localhost:4000", { auth: { kioskId: "K-AAAA" }, transports: ["websocket"] });
const B = io("http://localhost:4000", { auth: { kioskId: "K-BBBB" }, transports: ["websocket"] });

const events = [];
A.on("lock:update", (u) => events.push({ who: "A-saw", ...u }));
B.on("lock:update", (u) => events.push({ who: "B-saw", ...u }));

function emit(sock, ev, data) {
  return new Promise((resolve) => sock.emit(ev, data, resolve));
}

await new Promise((r) => A.on("connect", r));
await new Promise((r) => B.on("connect", r));
await new Promise((r) => setTimeout(r, 100));

console.log("\n=== TEST 1: A locks 123456, both should see it ===");
const r1 = await emit(A, "lock:acquire", { number: "123456" });
console.log("A lock result:", r1.ok, r1.entry?.kioskId);

console.log("\n=== TEST 2: B tries same number, should fail ===");
const r2 = await emit(B, "lock:acquire", { number: "123456" });
console.log("B lock result:", r2.ok, "reason:", r2.reason);

console.log("\n=== TEST 3: B locks different number 999999, OK ===");
const r3 = await emit(B, "lock:acquire", { number: "999999" });
console.log("B lock result:", r3.ok);

console.log("\n=== TEST 4: A releases 123456, B can now acquire ===");
await emit(A, "lock:release", { number: "123456" });
await new Promise((r) => setTimeout(r, 50));
const r4 = await emit(B, "lock:acquire", { number: "123456" });
console.log("B re-lock result:", r4.ok);

console.log("\n=== TEST 5: A disconnects, B should see 999999... wait, A holds nothing now. ===");
console.log("=== TEST 5b: B disconnects with held locks; auto-release ===");
B.disconnect();
await new Promise((r) => setTimeout(r, 100));

console.log("\n=== EVENTS broadcast ===");
for (const e of events) console.log(JSON.stringify(e));

A.disconnect();
process.exit(0);
