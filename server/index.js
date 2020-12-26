const fs = require("fs");
const WebSocket = require("ws");
const { Blockchain, transaction } = require("../src/blockchain");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

const wss = new WebSocket.Server({ port: 8080 });
console.log(
  "[INFO] " +
    Date().toString() +
    ":starting server on port 8080\n\taddress: ws://localhost:8080"
);
const IP = (request) => {
  const ip =
    request.headers["x-forwarded-for"] ||
    request.connection.remoteAddress ||
    request.socket.remoteAddress ||
    request.connection.socket.remoteAddress;
  const newIp = ip.replace(/[^0-9.]/g, "");
  return newIp;
};
const chain = new Blockchain();
try {
  const backup = fs.readFileSync("backup.json", "utf-8");
  const last = JSON.parse(backup);
  chain.chain = last.chain;
  chain.pendingTxn = last.pendingTxn;
  console.log(
    "[INFO] " +
      Date().toString() +
      ":recompiling old chain and pending blocks.\n\tblocks created: " +
      last.chain.length +
      "\n\tpending created: " +
      last.pendingTxn.length
  );
} catch (e) {
  console.log(
    "[WARNING] " +
      Date().toString() +
      ":No Backup of chain or pending blocks.\n\tdirectory: .\n\tfile: backup.json"
  );
}
const sendTxn = (prvKey, submittedTxn) => {
  const key = ec.keyFromPrivate(prvKey);
  if (
    chain.getBalance(key.getPublic("hex")) == 0 ||
    (chain.getBalance(key.getPublic("hex")) < submittedTxn.amount &&
      submittedTxn.from != null)
  ) {
    return JSON.stringify({
      type: "txn",
      msg: "your balance is to low",
      code: "LB",
      status: "fail",
    });
  }
  // const addr = key.getPublic("hex");
  try {
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
  } catch (e) {
    return JSON.stringify({
      type: "txn",
      msg: e.message,
      code: "E",
      status: "fail",
    });
  }
  // chain.addtxn(txn);
};

const sendBalance = (owner) => {
  const key = ec.genKeyPair();
  try {
    const txn = new transaction(owner, key.getPublic("hex"), 100);
    txn.signTxn(key);
    chain.addtxn(txn);
    return txn;
  } catch (e) {
    return {
      type: "newBalance",
      msg: e.message,
      code: "E",
      status: "fail",
    };
  }
};

const users = [];
let lastMiner = "";
wss.on("connection", (ws, req) => {
  users.push(req.headers["x-forwarded-for"] || req.connection.remoteAddress);
  ws.on("message", (message) => {
    const msg = JSON.parse(message);
    if (!users.includes(msg.privateKey) && msg.privateKey != undefined) {
      const key = ec.keyFromPrivate(msg.privateKey);
      users.push(users.push(key.getPublic("hex")));
    }

    if (msg.type == "txn") {
      const data = sendTxn(msg.privateKey, msg.transaction);
      ws.send(JSON.stringify(data));
      console.log(
        "[TRACE] " +
          Date().toString() +
          ": Received pending transaction.\n\tfrom: " +
          msg.transaction.from +
          "\n\tto: " +
          msg.transaction.to +
          "\n\tamount: " +
          msg.transaction.amount
      );
    } else if (msg.type == "mine") {
      const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
      let noLog = false;
      if (lastMiner == msg.owner && chain.pendingTxn.length == 0) {
        noLog = true;
      }
      lastMiner = msg.owner;
      let error = false;
      let errorMsg = "";
      if (!noLog && chain.pendingTxn.length != 0)
        console.log(
          "[TRACE] " +
            Date().toString() +
            ": " +
            IP(req) +
            " started mining block."
        );
      try {
        if (chain.pendingTxn.length != 0) {
          chain.minePending(msg.owner);
        } else {
          ws.send(
            JSON.stringify({
              type: "mine",
              msg: "No blocks to mine",
              code: "NMB",
              status: "fail",
            })
          );
          if (!noLog && chain.pendingTxn.length != 0)
            console.log("\tstatus: fail");
          return;
        }
      } catch (e) {
        error = true;
        errorMsg = e.message;
      }
      if (error) {
        ws.send(
          JSON.stringify({
            type: "mine",
            msg: errorMsg,
            code: "E",
            status: "fail",
          })
        );
        if (!noLog && chain.pendingTxn.length != 0)
          console.log("\tstatus: fail");
      } else {
        ws.send(
          JSON.stringify({
            type: "mine",
            msg: "",
            status: "success",
          })
        );
        if (!noLog && chain.pendingTxn.length != 0)
          console.log("\tstatus: success");
      }
    } else if (msg.type == "balance") {
      ws.send(chain.getBalance(msg.owner));
    } else if (msg.type == "newBalance") {
      const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
      if (users[0] === ip) {
        ws.send(JSON.stringify(sendBalance(msg.owner)));
        users.unshift("");
      }
    }

    // TODO: add mining request that returns pending array
  });
});

process.stdin.resume(); //so the program will not close instantly
function exitHandler(options, exitCode) {
  if (options.cleanup) {
    console.log(
      "[INFO]",
      Date().toString(),
      "\b: backing up chain and pending blocks"
    );
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
