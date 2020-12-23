const WebSocket = require("ws");
const { transaction } = require("../src/blockchain");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

const addr = process.env.coin_address;

const pair = ec.keyFromPrivate(addr, "hex");
let i = 0;
const ws = new WebSocket("ws://localhost:8080");

function task() {
    ws.send(
        JSON.stringify({
            type: "mine",
            owner: pair.getPublic("hex"),
        })
    );
    // delay
    i++;
    setTimeout(() => {
        task();
    }, 500);
}
ws.onopen = () => {
    ws.on("message", (d) => {
        const msg = JSON.parse(d);
        if (msg.code == "NMB") {
            return;
        } else {
            console.log("got 5 COIN");
        }
    });
    task();
};
