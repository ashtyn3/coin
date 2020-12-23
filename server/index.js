const fs = require("fs");
const WebSocket = require("ws");
const { Blockchain, transaction } = require("../src/blockchain");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

const wss = new WebSocket.Server({ port: 8080 });
const chain = new Blockchain();
const sendTxn = (prvKey, submittedTxn) => {
    const key = ec.keyFromPrivate(prvKey);
    if (
        chain.getBalance(key.getPublic("hex")) == 0 ||
        chain.getBalance(key.getPublic("hex")) < submittedTxn.amount
    ) {
        return JSON.stringify({
            type: "txn",
            msg: "your balance is to low",
            code: "LB",
            status: "fail",
        });
    }
    // const addr = key.getPublic("hex");
    const txn = new transaction(
        submittedTxn.to,
        submittedTxn.from,
        submittedTxn.amount
    );
    txn.signTxn(key);
    chain.addtxn(txn);
    return JSON.stringify({
        type: "txn",
        msg: txn.sig,
        status: "success",
    });
    // chain.addtxn(txn);
};
const users = [];

wss.on("connection", (ws) => {
    ws.on("message", (message) => {
        const msg = JSON.parse(message);
        if (!users.includes(msg.privateKey) && msg.privateKey != undefined) {
            const key = ec.keyFromPrivate(msg.privateKey);
            users.push(users.push(key.getPublic("hex")));
        }
        if (!users.includes(msg.owner) && msg.owner != undefined) {
            users.push(msg.owner);
        }

        if (msg.type == "txn") {
            const data = sendTxn(msg.privateKey, msg.transaction);
            ws.send(JSON.stringify(data));
        } else if (msg.type == "mine") {
            if (chain.pendingTxn.length == 0) {
                ws.send(
                    JSON.stringify({
                        type: "mine",
                        msg: "No blocks to mine",
                        code: "NMB",
                        status: "fail",
                    })
                );
            } else {
                chain.minePending(msg.owner);
                ws.send(
                    JSON.stringify({
                        type: "mine",
                        msg: "",
                        status: "success",
                    })
                );
            }
        } else if (msg.type == "balance") {
            ws.send(chain.getBalance(msg.owner));
        }
        // TODO: add mining request that returns pending array
    });
});

process.stdin.resume(); //so the program will not close instantly

function exitHandler(options, exitCode) {
    if (options.cleanup) {
        fs.writeFileSync("backup.json", JSON.stringify(chain));
    }
    // if (exitCode || exitCode === 0) ;
    if (options.exit) process.exit();
}

//do something when app is closing
process.on("exit", exitHandler.bind(null, { cleanup: true }));
//catches ctrl+c event
process.on("SIGINT", exitHandler.bind(null, { exit: true }));
// catches "kill pid" (for example: nodemon restart)
process.on("SIGUSR1", exitHandler.bind(null, { exit: true }));
process.on("SIGUSR2", exitHandler.bind(null, { exit: true }));
//catches uncaught exceptions
process.on("uncaughtException", exitHandler.bind(null, { exit: true }));
