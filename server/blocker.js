const fs = require("fs");
const crypto = require("crypto");
const { Blockchain, transaction } = require("../src/blockchain");
function dec(phrase, SECRET) {
  var decrypt = CryptoJS.AES.decrypt(
    {
      ciphertext: CryptoJS.enc.Hex.parse(phrase),
    },
    SECRET
  );
  return "hi";
}
("use strict");

var decrypt = (encrypted, ENC_KEY, IV) => {
  let decipher = crypto.createDecipheriv("aes-256-cbc", ENC_KEY, IV);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  return decrypted + decipher.final("utf8");
};
const genBlockHash = new Blockchain().createGenBlock().hash;
const main = (type, addr) => {
  let buffer = [];
  if (type == "blocks") {
    const file = fs.readFileSync("chain.blk", "utf-8").split("\n--\n");
    file
      .filter((l) => l.trim() != "" && l.trim() != "legacyChain")
      .forEach((l, n) => {
        if (n == 0) {
          const dec = decrypt(
            l,
            genBlockHash.slice(0, 32),
            genBlockHash.slice(0, 16)
          );
          const blk = JSON.parse(dec);
          blk.height = blk.transactions.length;
          buffer.push(blk);
        } else {
          const last = buffer[buffer.length - 1].hash;
          const dec = decrypt(l, last.slice(0, 32), last.slice(0, 16));
          const blk = JSON.parse(dec);
          blk.height = blk.transactions.length;
          buffer.push(blk);
        }
      });
  } else if (type == "confirmed") {
    const tempBuffer = main("blocks");
    tempBuffer.forEach((b) => {
      buffer.push(...b.transactions);
    });
  } else if (type == "unconfirmed") {
    const file = fs.readFileSync("pending.blk", "utf-8").split("\n--\n");
    file
      .filter((l) => l.trim() != "" && l.trim() != "legacyPending")
      .forEach((l, n) => {
        if (n == 0) {
          const dec = decrypt(
            l,
            genBlockHash.slice(0, 32) || "",
            genBlockHash.slice(0, 16) || ""
          );
          const blk = JSON.parse(dec);
          buffer.push(blk);
        } else {
          const last = buffer[buffer.length - 1].sig;
          const dec = decrypt(l, last.slice(0, 32), last.slice(0, 16));
          const blk = JSON.parse(dec);
          buffer.push(blk);
        }
      });
  }
  return buffer;
};

console.log(main("unconfirmed"));
console.log(main("confirmed"));
