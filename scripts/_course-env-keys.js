const fs = require("fs");
const lines = fs
  .readFileSync("E:/Projects/cource-buildx100/.env.local", "utf8")
  .split(/\r?\n/)
  .filter((l) => l && !l.startsWith("#") && l.includes("="));
console.log("KEYS");
for (const l of lines) {
  const i = l.indexOf("=");
  const k = l.slice(0, i);
  let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  console.log(k);
  if (k.includes("URL") && v.startsWith("http")) {
    console.log("HOST", k, new URL(v).origin);
  }
}
