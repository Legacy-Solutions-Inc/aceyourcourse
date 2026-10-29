"""Unpack a __bundler HTML export into its embedded source files."""
import base64, gzip, json, os, re, sys

EXT = {
    "application/javascript": ".js", "text/javascript": ".js", "text/html": ".html",
    "text/css": ".css", "application/json": ".json", "image/svg+xml": ".svg",
    "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "video/mp4": ".mp4",
    "font/woff2": ".woff2", "font/woff": ".woff", "font/ttf": ".ttf", "text/plain": ".txt",
}

def block(src, kind):
    m = re.search(r'<script type="__bundler/%s">(.*?)</script>' % kind, src, re.S)
    return json.loads(m.group(1)) if m else None

def main(html_path, out_dir):
    src = open(html_path, encoding="utf-8").read()
    manifest = block(src, "manifest") or {}
    ext = block(src, "ext_resources") or []
    names = {e["uuid"]: e["id"] for e in ext}
    os.makedirs(out_dir, exist_ok=True)
    index = []
    for uuid, entry in manifest.items():
        raw = base64.b64decode(entry["data"])
        if entry.get("compressed"):
            raw = gzip.decompress(raw)
        mime = entry.get("mime", "")
        name = names.get(uuid, uuid)
        safe = re.sub(r"[^A-Za-z0-9._-]+", "_", name.replace("%20", " ")).strip("_")
        if not os.path.splitext(safe)[1]:
            safe += EXT.get(mime.split(";")[0], ".bin")
        safe = uuid[:8] + "__" + safe
        with open(os.path.join(out_dir, safe), "wb") as f:
            f.write(raw)
        index.append((safe, mime, len(raw)))
    tpl = block(src, "template")
    if tpl:
        with open(os.path.join(out_dir, "_template.html"), "w", encoding="utf-8") as f:
            f.write(tpl if isinstance(tpl, str) else json.dumps(tpl))
    for row in sorted(index, key=lambda r: r[1]):
        print("%-70s %-28s %9d" % row)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
