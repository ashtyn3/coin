const { Blockchain, transaction } = require("./blockchain");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

const key = ec.keyFromPrivate(
    "0cb1f2e59e7e45c7ef8c7a6f3e1a2e58bace7b0d7f98841cc0f0faa758fb0f73"
);

const addr = key.getPublic("hex");

const coin = new Blockchain();
const txn = new transaction("something", addr, 2);

txn.signTxn(key);
coin.addtxn(txn);

coin.minePending(addr);
// const txn = coin.createtxn(new transaction("ashtyn", "bob", 5));
