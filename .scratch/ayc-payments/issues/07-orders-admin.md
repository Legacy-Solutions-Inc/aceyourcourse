# 07 — The Orders admin

**What to build:** Owners see every Order in a new "Orders & payments" screen in the SALES group, with search, filters, stats and a CSV export for the accountant, and an Order detail page to resolve payment questions.

- **Who:** Owners only; Editors are refused on the server.
- **The list:**
  - stats for the current filter: paid (Manila month by default), Orders, Pending, Failed
  - "Search by order number or email"
  - status (any, Paid, Pending, Failed, Expired, Refunded), Payment Method (all, QR Ph, GCash, Maya, Card), range (last 7 days, last 30 days by default, all time)
  - "Include test orders", off by default; Test Orders are tagged TEST
  - columns: Order, date, Member (email), item, method, amount, status
  - footer: "Payment status comes from PayMongo. Card details are never stored on the platform."
- **CSV export** of exactly the filtered Orders, one row each: reference, paid date and time (Manila), Member name and email, item, Exam, days, amount, Payment Method, status, amount refunded, PayMongo payment ID, and whether an invoice was requested with its name, address and TIN (empty until tickets 08 and 09 fill them). The export is logged in Staff Activity.
- **Order detail:**
  - Member (links to the Member detail page), item, amount, method, PayMongo reference, created
  - timeline by status (checkout started → paid with X → PayMongo confirmed, access granted; or waiting; or failed; "Paid after expiry" where it applies)
  - a status note, and an internal note only Admins see ("✓ NOTE SAVED · ONLY ADMINS SEE IT")
  - "Check status with PayMongo" (the same code as the status-check backup; result "CHECKED JUST NOW · STILL PENDING AT MAYA" or the new outcome applied) and "Open in PayMongo dashboard ↗"
  - "Refunds are issued from the PayMongo dashboard."
- **The Member detail page** (Users) gains an Orders section linking to each Order.

**Blocked by:** 04.

**Status:** ready-for-agent

Spec: Phase 4 → "Orders Admin", "Phase 4 planning decisions → Orders and sales figures"; stories 147, 148, 151o, 151z.

- [ ] An Owner finds an Order by its reference and by the Member's email.
- [ ] Filtering by GCash and Paid shows only those Orders, and the CSV holds exactly them.
- [ ] Test Orders appear only with "Include test orders" ticked.
- [ ] "Check status with PayMongo" on a Pending Order that PayMongo says is paid makes it Paid and grants the days (with the fake).
- [ ] A Member's detail page lists their Orders.
- [ ] **Sad paths, each with a test:**
  - an Editor is refused the list, the detail, the CSV, the note and the status check on the server
  - an empty filter shows "No Orders match" and the CSV has only the header row
  - a CSV cell starting with =, +, - or @ is escaped against spreadsheet formula injection
  - an unknown Order reference answers not found
  - a stale internal note hits the conflict check
  - the date range uses Manila day boundaries
