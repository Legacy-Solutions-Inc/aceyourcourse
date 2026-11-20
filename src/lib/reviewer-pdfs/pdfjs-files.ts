// Where pdf.js's own files are (Phase 3, tickets 12 and 14): pdfjs-dist, in
// the app's folder (process.cwd()), where the build's file tracing puts what
// each route reads (next.config.ts). The renderer (page-images.pdfjs.ts)
// reads its data files as it renders, and the stamper draws its text in a
// font pdf.js ships (page-images.sharp.ts).
//
// They're found from the app's folder, never with a package lookup: the
// bundler turns `require.resolve("pdfjs-dist/…")` into a module number, so a
// path built from it throws on the server (it did, for the renderer).

/** pdfjs-dist's folder, relative to the app's. */
export const PDFJS_DIR = "node_modules/pdfjs-dist";

/** The folders of data files pdf.js reads as it renders: standard fonts, CMaps, ICC profiles and wasm decoders. */
export const PDFJS_DATA_FOLDERS = ["standard_fonts", "cmaps", "iccs", "wasm"] as const;

/** Pure: what file tracing sends with the job's run route, so pdf.js finds its files on the server. */
export const tracedPdfjsFiles = (): string[] => [
  `./${PDFJS_DIR}/package.json`,
  ...PDFJS_DATA_FOLDERS.map((folder) => `./${PDFJS_DIR}/${folder}/**`),
];
