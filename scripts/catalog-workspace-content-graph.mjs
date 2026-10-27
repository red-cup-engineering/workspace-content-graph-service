#!/usr/bin/env node
import { catalogWorkspaceContentGraph } from "../src/workspace-content-graph.mjs";

const chunks = [];
let bytes = 0;
for await (const chunk of process.stdin) {
  bytes += chunk.length;
  if (bytes > 16_777_216) throw new TypeError("observed workspace carrier exceeds 16777216 UTF-8 bytes");
  chunks.push(chunk);
}
const source = Buffer.concat(chunks).toString("utf8");
const input = JSON.parse(source);
process.stdout.write(`${JSON.stringify(catalogWorkspaceContentGraph(input))}\n`);

