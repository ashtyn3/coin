const express = require("express");
const bl = require("./blocker");
const app = express();
const port = 3000;

app.get("/api/blocks", (req, res) => {
  res.json(bl());
});

app.get("/api/pendingtxn", (req, res) => {
  res.json(bl());
});
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
