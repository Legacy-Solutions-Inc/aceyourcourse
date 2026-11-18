// pdf.js's worker module ships without types. The Reviewer PDF renderer
// (src/services/page-images.pdfjs.ts) imports it only for what it does on
// import: it hands pdf.js the worker's code, so pdf.js runs in the server's
// own thread.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs";
