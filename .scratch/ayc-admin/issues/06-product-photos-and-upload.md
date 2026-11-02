# 06 — Product photos, and the upload seam

**What to build:** Editors manage a Product's photos in the editor's photo strip.

- **Adding photos.** The browser uploads each file straight to a one-time upload URL the server hands it. In the prototype, that's a development-only route that keeps the file in memory.
- **The rules:**
  - JPEG, PNG or WebP, up to 10 MB
  - a warning, not a block, below 1000 × 1000 or when the photo isn't square
  - the first photo is the cover
  - drag to reorder, with a keyboard alternative
  - remove a photo
- **Saving.** Photo changes save with the Product, and the Website shows the new photos, cover and order.

**Blocked by:** 05 — Product editor

**Status:** ready-for-agent

Spec: Phase 2 story 64 (photos); Implementation Decisions → Phase 2 (Seams: Image upload; Products: photos). Mockup: BUILD-MAP §3.3 ("PHOTOS · FIRST IS THE COVER"). Conventions: §2 (dev upload route), §3 (Upload seam).

- [ ] The strip follows the mockup: thumbnails, a "+" tile, and "N photos · drag to reorder". A new Product shows "Add photos. Square images work best, at least 1000 × 1000."
- [ ] **Uploading.** Choosing or dropping files uploads them one by one, with progress. Each finished upload appears in the strip as unsaved, and "Save product" attaches them.
- [ ] **Type and size.**
  - A file that isn't JPEG, PNG or WebP, or is over 10 MB, is refused before upload, with the file named.
  - The server refuses it too: `createUpload` rejects the type or size, and the upload route rejects a body that doesn't match the declared type or size.
- [ ] **Warnings.** Below 1000 × 1000, or not square, the photo shows a warning badge and can still be saved.
- [ ] **Reordering and removing.**
  - Drag to reorder, or use "Move left" and "Move right" on each photo for keyboard and screen-reader users.
  - The first photo is labelled COVER.
  - Remove takes a photo out.
  - Removing the last photo of a Live Product is refused: "A Live Product needs at least one photo."
- [ ] **Alt text** is generated on save ("{full name}, photo N of M"), and the Website uses it.
- [ ] **The upload URL is one-time.** A second `PUT` to the same URL is refused. A `GET` serves the image with its content type. In production, both answer 404.
- [ ] **Live on save.** After saving, the Website's Product page gallery, its card and its Exam page show the new cover and order.
- [ ] **Sad paths**, each tested:
  - a network failure mid-upload shows "Upload failed · Try again" for that file only
  - the server refuses a type or size
  - a reused URL is refused
  - saving with a photo whose upload never finished is refused
  - a stale save gets the conflict message
  - an Editor's upload works, while a signed-out `createUpload` is refused
- [ ] **Tests:** the upload seam contract, the route, the photo rules in the Products seam, an e2e that uploads a fixture image, reorders and saves, then sees the Website's new cover, and axe.
