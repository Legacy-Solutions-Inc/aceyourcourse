# 02 — Settings, and the shared save path

**What to build:** An Owner edits the Website's contact email, Marketplace shop links, social links and shop-wide trust figures in Settings. Each save goes live on the Website at once: the footer, the store buttons and the trust line all update.

This ticket also builds the save path every later editor reuses:

- the editable sample store, with Reset
- the Catalogue mock arm reading that store, and the Website reads cached with tags
- the Admin seam's write contract:
  - validation
  - the conflict check
  - Staff Activity
  - the cache tags to clear
- `adminAction`
- the save-state line, the conflict notice and the "Couldn't save" toast

**Blocked by:** 01 — Admin shell and Staff sign-in

**Status:** ready-for-agent

Spec: Phase 2 stories 78, 79, 80; Implementation Decisions → Phase 2 (Seams: Catalogue and Admin, Settings, Live on save, Conflict check, Staff Activity) and Phase 1 → Rendering and caching. Mockup: BUILD-MAP §3.11 (SUPPORT EMAIL and STORE & SOCIAL LINKS; Admin accounts is ticket 03). Conventions: §3 (all), §6.

- [ ] Settings follows the mockup's layout and copy for these parts:
  - **The contact email.** The mockup's support email, relabelled. The test email and the subject line are dropped.
  - **Store and social links:** Shopee, Lazada, TikTok Shop, plus TikTok, Facebook and Instagram profiles.
  - **The trust figures:** rating, number of ratings and followers, with "AS OF".
  - **"LAST CHANGED {date} BY {name}".**

  The Admin accounts part is left for ticket 03.

- [ ] **Validation**, with the mockup's messages:
  - "ENTER A VALID EMAIL ADDRESS"
  - "SHOULD BE A SHOPEE.PH LINK", "…LAZADA.COM.PH…", "…TIKTOK LINK" and "SHOULD LOOK LIKE TIKTOK.COM/@NAME"
  - matching checks for facebook.com and instagram.com
  - rating from 0 to 5 with one decimal; ratings a whole number of 0 or more; followers as text, e.g. "3.7K"

  An empty link hides that button or link on the Website.

- [ ] Saving the trust figures sets "as of" to today in Manila time.
- [ ] A save shows "✓ SAVED · EVERY STORE BUTTON UPDATED". The Website's footer, store buttons and trust line show the new values on the next page load, with no restart.
- [ ] **Save states:**
  - Up to date
  - Unsaved changes
  - Saving
  - Saved · live
  - an error that keeps the form's values
- [ ] **The conflict check.** When two Owners edit, the second save fails with "{Name} saved these settings at {time}. Copy your changes, then reload to see theirs.", and its form keeps its values.
- [ ] **A failed save** shows the "Couldn't save" toast: "… Your edits are still in the form." Try again resubmits.
- [ ] **Editors are refused on the server.** Calling the action as an Editor returns forbidden, and nothing changes.
- [ ] **Staff Activity.** Every save appends one record with the before and after values.
- [ ] **Bad writes change nothing.** A write that would make the catalogue invalid leaves the store unchanged.
- [ ] **Reset.** The header's Reset button and `POST /api/dev/sample-data/reset` both restore the seed and clear every catalogue tag. A dev server restart also starts from the seed.
- [ ] **Phase 1 still passes.** Every existing Catalogue seam, page and e2e test passes with the store-backed mock and the tagged cache.
