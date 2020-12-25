const WebSocket = require("ws");
const { transaction } = require("../src/blockchain");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

const ws = new WebSocket("ws://localhost:8080");
// ws.ping();
const pair = ec.keyFromPrivate(
  "0cb1f2e59e7e45c7ef8c7a6f3e1a2e58bace7b0d7f98841cc0f0faa758fb0f73",
  "hex"
);
ws.onopen = (socket) => {
  console.log("connected");
  ws.send(
    JSON.stringify({
      type: "txn",
      privateKey: pair.getPrivate("hex"),
      transaction: new transaction("idk", pair.getPublic("hex"), 10),
    })
  );
  // ws.emit("message", "zoom");
  // socket.broadcast.emit("message", "hello world");
};
ws.on("message", (data) => {
  console.log("\nnext:" + data);
});
