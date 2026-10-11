// Prints the app events the stream parser produces for the saved CLI fixture. Run after npm run build.
const fs = require("node:fs");
const path = require("node:path");
const { createParser } = require("../dist/chat/stream-parser");

const lines = fs.readFileSync(path.join(__dirname, "chat-stream.jsonl"), "utf8").split("\n").filter(Boolean);
const parser = createParser();
let text = "";
for (const line of lines) {
  for (const e of parser.feed(line)) {
    if (e.type === "delta") text += e.text;
    else console.log(JSON.stringify(e));
  }
}
console.log(`reply text (${text.length} chars): ${text}`);
