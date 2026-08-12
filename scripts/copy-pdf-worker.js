#!/usr/bin/env node
/**
 * Copies pdfjs worker to /public so the SW can precache a stable URL
 * for offline travel PDF ticket viewing.
 *
 * Prepends a Math.sumPrecise shim — pdf.js 5.x modern worker assumes it.
 */
const fs = require("node:fs");
const path = require("node:path");

const source = path.join(
  __dirname,
  "..",
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.worker.min.mjs",
);
const target = path.join(__dirname, "..", "public", "pdf.worker.min.mjs");

const SUM_PRECISE_SHIM = `if(typeof Math.sumPrecise!=="function"){Math.sumPrecise=function(values){let total=0;for(const value of values){total+=value}return total}}
`;

if (!fs.existsSync(source)) {
  console.warn(
    "[copy-pdf-worker] pdfjs-dist worker missing; skip (install deps first).",
  );
  process.exit(0);
}

const targetDir = path.dirname(target);
fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(target, SUM_PRECISE_SHIM + fs.readFileSync(source, "utf8"));
console.log("[copy-pdf-worker] wrote public/pdf.worker.min.mjs");
