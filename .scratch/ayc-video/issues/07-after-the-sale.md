# 07 — After the sale

**What to build:** Course Orders are handled like Plan Orders everywhere after checkout. Refunds remove the Course, Owners can give or remove a Course, Members see their Courses on Billing, and the Owner's records, figures and exports include Course sales.

- **Refunds:**
  - A full refund of a Course Order makes it Refunded and removes the Course Ownership, unless another Paid Order or a gift still holds it.
  - The Member gets a notice: "Your refund for AYC-10483 was processed. You no longer own the PSAD Masterclass." It's logged as "PayMongo (system)".
  - A partial refund leaves ownership unchanged, and the Order shows "PARTIALLY REFUNDED · ₱300". Partial refunds adding up to the full amount count as a full refund.
- **Giving a Course** (Owner-only, on the Member's page in the Admin):
  - **"Give Course":** pick a separately sold Course. The Member gets Course Ownership with the source "Given by Ace Your Course", and a notice: "You now own the PSAD Masterclass". It's logged in Staff Activity.
  - **"Remove Course":** works only on a given Ownership, with a notice to the Member. A paid one goes only by a full refund in PayMongo.
  - Giving a Course the Member already owns is refused. Editors can do neither.
  - The Member's page lists their Courses with each one's source.
- **Billing:**
  - "Your Courses" beside Access Passes: name, since, and the source (the Order reference or "Given by Ace Your Course").
  - The Payment Acknowledgement for a Course Order: "PSAD Masterclass · Video course · yours to keep", with no access period. An Invoice Request works the same as for Plans.
- **The Orders admin:** the Course's name in the list, detail and CSV, and a Plans vs Courses filter in the URL.
- **Sales figures** count paid Course Orders, with refunds subtracted on their own day and Test Orders left out.
- **Deleting an account:**
  - removes its Course Ownerships, like its Access Passes
  - keeps its Course Orders, detached ("Account deleted")
  - is still blocked while any Order is Pending
  - the "N paid Orders are kept…" count includes Course Orders
- **"Download this Member's data"** adds Course Ownerships and Lesson progress, with a new export version; older-version tests stay meaningful.

**Blocked by:** 06.

**Status:** ready-for-agent

Spec: Phase 5 → "Phase 5 planning decisions" (The Order ledger for Course Orders, Giving a Course, Everywhere else, Course Orders follow Phase 4); Phase 4 → "Phase 4 planning decisions" (Refunds, Deleting an account that has Orders); stories 143, 144, 172, 182, 183, 184.

- [ ] A full refund of Bea's "PSAD Masterclass" Order removes the Course from her Courses screen and Billing, and she gets the notice.
- [ ] An Owner gives "HPGE Crash Course" to a Member, who sees it OWNED and the notice; the Owner then removes it.
- [ ] Billing shows "Your Courses" with the source, and the Course Order's Payment Acknowledgement prints the Course line.
- [ ] An Owner filters Orders to Courses and exports a CSV with the Course's name; today's paid total includes the Course Order.
- [ ] **Sad paths, each with a test:**
  - a full refund of one of two Paid Orders for the same Course keeps the ownership
  - a refund never removes a given Ownership
  - a partial refund leaves ownership unchanged; partials adding up to the full amount remove it
  - "Remove Course" is refused for a paid Ownership; "Give Course" is refused when the Member already owns it
  - an Editor is refused giving and removing on the server
  - a Test Order for a Course isn't counted in the sales figures
  - deleting an account removes its Course Ownerships and keeps its Course Orders detached; it's refused while a Course Order is Pending
  - the data export includes Course Ownerships and Lesson progress, and older export versions still read correctly
  - another Member's Courses or Orders are never readable in the Member App
