#!/usr/bin/env node
/**
 * Copies pdfjs worker to /public so the SW can precache a stable URL
 * for offline travel PDF ticket viewing.
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

if (!fs.existsSync(source)) {
  console.warn(
    "[copy-pdf-worker] pdfjs-dist worker missing; skip (install deps first).",
  );
  process.exit(0);
}

fs.copyFileSync(source, target);
console.log("[copy-pdf-worker] wrote public/pdf.worker.min.mjs");
