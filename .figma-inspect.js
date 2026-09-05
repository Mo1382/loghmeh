const fs = require("fs");

const p = process.argv[2];
const raw = fs.readFileSync(p, "utf8");
const start = raw.indexOf('{"ok"');
const json = JSON.parse(raw.slice(start));

console.error("data keys:", Object.keys(json.data));
if (json.data.nodes) console.error("node keys:", Object.keys(json.data.nodes));
const holder = json.data.nodes
  ? Object.values(json.data.nodes)[0]
  : json.data;
const doc = holder.document || holder;

function findSection(node, name) {
  if (node.name === name) return node;
  for (const c of node.children || []) {
    const r = findSection(c, name);
    if (r) return r;
  }
  return null;
}

const btn = findSection(doc, "Button");
if (!btn) {
  console.log("Button section not found. Top-level children:");
  for (const c of doc.children || []) console.log(" -", c.name, c.type, c.id);
  process.exit(0);
}

const rows = [];
for (const c of btn.children || []) {
  const b = c.bounds || c.absoluteBoundingBox || {};
  rows.push({
    x: b.x,
    y: b.y,
    w: b.width,
    h: b.height,
    name: c.name,
    type: c.type,
    id: c.id,
  });
}

rows.sort((a, b) => a.y - b.y || a.x - b.x);
for (const r of rows) {
  console.log(
    `${String(r.x).padStart(6)},${String(r.y).padStart(6)}  ${String(
      r.w
    ).padStart(5)}x${String(r.h).padEnd(5)} ${r.type.padEnd(10)} ${r.id.padEnd(
      12
    )} ${r.name}`
  );
}
console.log("total:", rows.length);
