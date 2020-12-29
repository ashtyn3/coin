// const { time } = require("console");
const crypto = require("crypto");
const { format } = require("path");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

class transaction {
  constructor(to, from, amount) {
    this.from = from;
    this.to = to;
    this.amount = amount;
  }
  calcHash() {
    return crypto
      .createHash("sha256")
      .update(this.from + this.to + this.amount)
      .digest("hex");
  }
  signTxn(key) {
    if (key.getPublic("hex") !== this.from) {
      throw new Error("Cannot sign transaction for other wallets.");
    }
    const hash = this.calcHash();
    const sig = key.sign(hash, "base64");
    this.sig = sig.toDER("hex");
  }
  valid() {
    if (this.from == null) return true;
    if (!this.sig || this.sig.length == 0) throw new Error("No signature.");
    const pub = ec.keyFromPublic(this.from, "hex");
    return pub.verify(this.calcHash(), this.sig);
  }
}

class Block {
  constructor(timestamp, transactions, previousHash = "") {
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.nonce = 0;
    this.hash = this.calchash();
  }
  calchash() {
    return crypto
      .createHash("sha256")
      .update(
        this.previousHash +
          this.timestamp +
          JSON.stringify(this.transactions) +
          this.nonce
      )
      .digest("hex");
  }
  mineBlock(difficulty) {
    while (
      this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")
    ) {
      this.nonce++;
      this.hash = this.calchash();
    }
  }
  validtxn() {
    for (const txn of this.transactions) {
      if (!txn.valid()) return false;
    }
    return true;
  }
}

class Blockchain {
  constructor() {
    this.chain = [this.createGenBlock()];
    this.pendingTxn = [];
    this.reward = 5;
    this.difficulty = Math.abs(this.pendingTxn.length - 2);
  }
  createGenBlock() {
    return new Block(0, "0/0/00", "");
  }

  getLatest() {
    return this.chain[this.chain.length - 1];
  }

  minePending(to) {
    const rewardTx = new transaction(
      to,
      null,
      (this.pendingTxn.length / 100) * this.difficulty + 0.1
    );
    this.pendingTxn.push(rewardTx);
    let block = new Block(Date.now(), this.pendingTxn, this.getLatest().hash);
    //block.mineBlock(this.difficulty);
    //this.chain.push(block);
    //this.pendingTxn = [];
    return block.calchash(), block;
  }

  addtxn(txn) {
    if (!txn.from || !txn.to) {
      throw new Error("Unknown to or from address.");
    }
    if (!txn.valid()) {
      throw new Error("cannot add stale transaction to chain.");
    }
    this.pendingTxn.push(txn);
  }
  validate() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const preBlock = this.chain[i - 1];
      if (!currentBlock.validtxn()) return false;
      if (currentBlock.hash !== currentBlock.calchash()) return false;
      if (currentBlock.previousHash !== preBlock.hash) return false;
    }
    return true;
  }
  getBalance(addr) {
    let balance = 0;
    for (const block of this.chain) {
      for (const txn of block.transactions) {
        if (txn.from == addr) balance -= txn.amount;
        if (txn.to == addr) balance += txn.amount;
      }
    }
    return balance;
  }
}

module.exports = { transaction, Block, Blockchain };
