// Writes the Reviewer PDF fixtures beside this file (ticket 12), each a few
// hundred bytes: `node test/fixtures/reviewer-pdfs/make-fixtures.mjs`.
//   - three-pages.pdf: 3 US Letter pages, "Page 1" to "Page 3" in Helvetica.
//   - password.pdf: the same 3 pages, encrypted with the user password
//     "secret" (the standard security handler, RC4 40-bit, revision 2), so
//     it can't be opened without it.
//   - corrupt.pdf: a PDF header, then bytes that aren't a PDF.
// The PDFs are written by hand, so no PDF library is needed to make them.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const PADDING = Buffer.from(
  "28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a",
  "hex",
);
const PERMISSIONS = -4;
const FILE_ID = Buffer.from("ace-your-course-reviewer-pdf-01".slice(0, 16), "latin1");

const md5 = (...parts) => createHash("md5").update(Buffer.concat(parts)).digest();

/** RC4, written out: Node's OpenSSL 3 no longer offers it. */
function rc4(key, data) {
  const s = [...Array(256).keys()];
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = Buffer.alloc(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
    out[n] = data[n] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

const pad = (password) => Buffer.concat([Buffer.from(password, "latin1"), PADDING]).subarray(0, 32);

/** The standard security handler, revision 2: the O and U values and the file key. */
function security(userPassword, ownerPassword) {
  const owner = rc4(md5(pad(ownerPassword)).subarray(0, 5), pad(userPassword));
  const p = Buffer.alloc(4);
  p.writeInt32LE(PERMISSIONS);
  const key = md5(pad(userPassword), owner, p, FILE_ID).subarray(0, 5);
  return { owner, user: rc4(key, PADDING), key };
}

/** Pure: a PDF of these page texts, encrypted when given the security values. */
function pdf(texts, secured) {
  const objects = [];
  const add = (body) => objects.push(body) && objects.length;
  const crypt = (number, data) =>
    secured
      ? rc4(
          md5(
            secured.key,
            Buffer.from([number & 255, (number >> 8) & 255, number >> 16, 0, 0]),
          ).subarray(0, 10),
          data,
        )
      : data;

  add(null); // 1: the catalog, below
  add(null); // 2: the pages
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const kids = texts.map((text) => {
    const number = objects.length + 1;
    const content = Buffer.from(
      `0.85 0.9 1 rg 72 72 468 648 re f 0 0 0 rg BT /F1 48 Tf 200 400 Td (${text}) Tj ET`,
      "latin1",
    );
    add({ stream: content, number });
    return add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${number} 0 R >>`,
    );
  });
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${kids.map((kid) => `${kid} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  const encrypt = secured
    ? add(
        `<< /Filter /Standard /V 1 /R 2 /O <${secured.owner.toString("hex")}> /U <${secured.user.toString("hex")}> /P ${PERMISSIONS} >>`,
      )
    : null;

  const chunks = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  let length = chunks[0].length;
  const offsets = [];
  const push = (chunk) => {
    chunks.push(chunk);
    length += chunk.length;
  };
  objects.forEach((body, index) => {
    offsets.push(length);
    const number = index + 1;
    if (typeof body === "string") {
      push(Buffer.from(`${number} 0 obj\n${body}\nendobj\n`, "latin1"));
    } else {
      const data = crypt(number, body.stream);
      push(Buffer.from(`${number} 0 obj\n<< /Length ${data.length} >>\nstream\n`, "latin1"));
      push(data);
      push(Buffer.from("\nendstream\nendobj\n", "latin1"));
    }
  });
  const xref = length;
  const entries = offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`);
  const id = FILE_ID.toString("hex");
  push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries.join("")}` +
        `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R` +
        (encrypt ? ` /Encrypt ${encrypt} 0 R` : "") +
        ` /ID [<${id}> <${id}>] >>\nstartxref\n${xref}\n%%EOF\n`,
      "latin1",
    ),
  );
  return Buffer.concat(chunks);
}

const PAGES = ["Page 1", "Page 2", "Page 3"];
writeFileSync(join(here, "three-pages.pdf"), pdf(PAGES, null));
writeFileSync(join(here, "password.pdf"), pdf(PAGES, security("secret", "owner-secret")));
writeFileSync(
  join(here, "corrupt.pdf"),
  Buffer.concat([
    Buffer.from("%PDF-1.7\n", "latin1"),
    Buffer.from("This file was a PDF once, but its body is gone.\n".repeat(8), "latin1"),
  ]),
);
