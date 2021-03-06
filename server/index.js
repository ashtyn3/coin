const fs = require("fs");
const { exec } = require("child_process");

const WebSocket = require("ws");
const { Blockchain, transaction } = require("../src/blockchain");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");
const crypto = require("crypto");
const cr = require("crypto-js");
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
if (!fs.existsSync("chain.blk")) {
  fs.writeFileSync("chain.blk", "legacyChain");
}

if (!fs.existsSync("pending.blk")) {
  fs.writeFileSync("pending.blk", "legacyPending");
}
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
var enc = (val, ENC_KEY, IV) => {
  let cipher = crypto.createCipheriv("aes-256-cbc", ENC_KEY, IV);
  let encrypted = cipher.update(val, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
};
wss.broadcast = function (data) {
  wss.clients.forEach((client) => client.send(data));
};
const sendTxn = (prvKey, submittedTxn, faucet) => {
  const key = ec.keyFromPrivate(prvKey);
  if (
    chain.getBalance(key.getPublic("hex")) == 0 ||
    (chain.getBalance(key.getPublic("hex")) < submittedTxn.amount &&
      submittedTxn.from != null &&
      faucet != true)
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
    if (chain.pendingTxn.length == 1) {
      fs.appendFileSync(
        "pending.blk",
        "\n--\n" +
          enc(
            JSON.stringify(txn),
            chain.chain[0].hash.slice(0, 32),
            chain.chain[0].hash.slice(0, 16)
          )
      );
    } else {
      fs.appendFileSync(
        "pending.blk",
        "\n--\n" +
          enc(
            JSON.stringify(txn),
            chain.pendingTxn[chain.pendingTxn.length - 1].sig.slice(0, 32),
            chain.pendingTxn[chain.pendingTxn.length - 1].sig.slice(0, 16)
          )
      );
    }
    return JSON.stringify({
      type: "txn",
      msg: txn.sig,
      status: "success",
    });
  } catch (e) {
    console.log(e);
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

const dnc = (phrase, pw) => {
  const key = crypto.createHash("sha256").update(pw).digest(),
    decipher = crypto.createDecipheriv("aes256", key, resizedIV),
    msg = [];

  msg.push(decipher.update(phrase, "hex", "binary"));

  msg.push(decipher.final("binary"));
  return msg.join("");
};
wss.on("connection", (ws, req) => {
  console.log(wss.clients);

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
          ws.send(
            JSON.stringify({
              target: Array(Math.abs(chain.difficulty) + 1).join("0"),
              difficulty: chain.difficulty,
              hash: chain.minePending(msg.owner),
            })
          );
          //chain.minePending(msg.owner);
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
        console.log(e);
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
      }
    } else if (msg.type == "done") {
      try {
        if (msg.block.hash.substring(0, chain.difficulty) == msg.target) {
          ws.send(
            JSON.stringify({
              type: "mine",
              msg: "",
              status: "success",
            })
          );
          fs.appendFileSync(
            "chain.blk",
            "\n--\n" +
              enc(
                JSON.stringify(msg.block),
                chain.getLatest().hash.slice(0, 32),
                chain.getLatest().hash.slice(0, 16)
              )
          );
          chain.chain.push(msg.block);
          chain.pendingTxn = [];
          exec("rm pending.blk", (error, stdout, stderr) => {
            if (error) {
              console.log(`error: ${error.message}`);
              return;
            }
            if (stderr) {
              console.log(`stderr: ${stderr}`);
              return;
            }
            fs.writeFileSync("pending.blk", "legacyPending");
          });
          console.log("\tstatus: success");
        } else {
          ws.send(
            JSON.stringify({
              type: "done",
              msg: "",
              status: "fail",
            })
          );
          console.log("\tstatus: fail");
        }
      } catch (err) {
        console.log(err);
        ws.send(
          JSON.stringify({
            type: "done",
            msg: err.message,
            code: "E",
            status: "fail",
          })
        );
      }
    } else if (msg.type == "balance") {
      ws.send(chain.getBalance(msg.owner));
    } else if (msg.type == "newBalance") {
      const key = ec.genKeyPair();
      const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
      if (users[0] === ip) {
        const key = ec.genKeyPair();
        sendTxn(
          key.getPrivate("hex"),
          new transaction(msg.owner, key.getPublic("hex"), 100),
          true
        );
        //ws.send(JSON.stringify(sendBalance(msg.owner)));
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
