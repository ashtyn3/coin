const WebSocket = require("ws");
const { transaction } = require("../src/blockchain");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");
const crypto = require("crypto");
const addr = process.env.coin_address;

const pair = ec.keyFromPrivate(addr, "hex");
let i = 0;
const ws = new WebSocket("ws://localhost:8080");

function task() {
  process.stdout.write("sending request");
  setTimeout(() => {
    process.stdout.write(".");
  }, 300);
  setTimeout(() => {
    process.stdout.write(".");
  }, 300);
  setTimeout(() => {
    process.stdout.write(".");
  }, 300);
  setTimeout(() => {
    process.stdout.write("");
  }, 300);
  ws.send(
    JSON.stringify({
      type: "mine",
      owner: pair.getPublic("hex"),
    })
  );
  // delay
  i++;
  setTimeout(() => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);

    task();
  }, 1000);
}
const calchash = (block) => {
  block.hash = crypto
    .createHash("sha256")
    .update(
      block.previousHash +
        block.timestamp +
        JSON.stringify(block.transactions) +
        block.nonce
    )
    .digest("hex");
  return block;
};
ws.onopen = () => {
  ws.on("message", (d) => {
    const msg = JSON.parse(d);
    if (msg.code == "NMB") {
      return;
    } else {
      let nonce = 0;
      if (msg.status == "fail") {
        console.log("ERROR: " + msg.msg);
      } else {
        let block = msg.hash;
        while (block?.hash.substring(0, msg.target.length) !== msg.target) {
          block.nonce += 1;
          msg.hash.hash = calchash(msg.hash).hash;
        }
        if (block != undefined) {
          ws.send(
            JSON.stringify({
              type: "done",
              block: block,
              target: msg.target,
            })
          );
          const reward = block.transactions.length + 5 - 1;
          console.log("\nmined block with reward: " + reward);
        }
      }
    }
  });
  task();
};
