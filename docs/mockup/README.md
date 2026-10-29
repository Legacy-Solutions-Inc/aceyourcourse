# Ace Your Course mockup (design reference)

The Claude Design prototype of all three Surfaces, unpacked from
`Ace Your Course Mockup (1).zip` (exported 2026-10-29).

> **Reference, not spec.** The mockup shows intended screens, flows and copy.
> It also has placeholder data, hardcoded values and bugs. Where it disagrees
> with `docs/specs/`, `docs/adr/` or `CONTEXT.md`, those win. Examples are the
> "₱0" price on Coming Soon Products, Gmail versus `support@`, and per-type
> Plan unlocks (see ADR 0010).

## Layout

| Path | What it is |
|---|---|
| `website/` | Public Website pages: `Home_v2`, `Products_v2`, `Product`, `Exam_v2`, `Reviews_v2`, `FAQ_v2`, `About_v2`, `Legal`, and the `SiteNav`, `SiteFooter`, `ProductCard` and `ReviewCard` components. |
| `member-app/` | The Member App: one file, `MemberApp_v2.dc.html`, with 28 screen states. |
| `admin/` | The Admin: `AdminDashboard_v2.dc.html` (all sections) and `ReviewCard`. |
| `*/BUILD-MAP.md` | **Start here.** For each Surface: every screen, section, field, status, interaction and business rule, with line references into the source. |
| `*/_template.html` | The prototype shell: hash routing and the mobile breakpoint (760px). Not for reuse. |
| `aycData.js` | The shared mock data: Products, Exams, Subjects, Reviews and Marketplace links. It seeds Phase 1. |
| `assets/` | Brand marks, sample flashcard PNGs, About photos, the promo video poster, and the Coming Soon placeholder. |
| `tools/unbundle.py` | Re-extracts every embedded file, including the Shopee product photos, from the zip's self-contained exports: `python3 tools/unbundle.py "<export>.html" <out-dir>`. |

## Reading the `.dc.html` files

Each file is a design-tool component. The markup comes first, and a `DCLogic`
class at the bottom computes the values the markup renders. `liveVals()` holds
state and interactions, and `renderVals()` holds the derived display values.
They are prototypes: read them for layout, copy and behaviour, not for code to
port.

## Not included

- **The 20 MB self-contained HTML exports**, and the React and font bundles.
- **Shopee product photos.** The real ones come from the client's catalogue
  spreadsheet into `public/`; `tools/unbundle.py` can extract the mockup's
  copies.
- **The promo video** `ayc-main-ad.mp4` (14.5 MB, 59 s, 720p) is in the source
  zip under `export/assets/`. Phase 1 adds a compressed version (about 2–4 MB)
  to the app.
