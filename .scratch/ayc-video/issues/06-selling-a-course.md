# 06 — Selling a Course

**What to build:** Owners choose which Courses are sold separately and set their prices. Members buy one through Phase 4's checkout and own it for good. The Terms of Use explain it.

- **The Owner's switch** in Course settings: "Included in {Exam} All-Access" ↔ "Sold separately". Editors see it read-only, and it's refused for them on the server.
  - The change takes effect at once, after a confirmation saying how many Members it affects:
    - Included → Sold separately: Members who watched it through their Access Pass lose it, progress kept.
    - Sold separately → Included: Course Ownerships stay, and Access Pass holders gain it.
  - Course settings shows the price read-only, with a link to Plans & prices.
- **Plans & prices → One-time purchases** (Owner-only): each separately sold Course with its price (whole pesos, within the same limits as Plans) and On sale.
  - Switching a Course to Sold separately adds it here, not on sale until an Owner sets the price and turns it on.
  - Changes are logged in Staff Activity like Plans.
- **The Plans page** gets a "One-time purchases" section for the selected Exam, listing its separately sold, Visible Courses on sale: "PSAD Masterclass · Video course only · yours to keep · ₱1,499".
  - An Exam with only a Course on sale still gets a pill.
  - "Unlock for ₱1,499" on the Courses screen opens that Exam's Plans page at the Course.
  - An owned Course shows "Owned · Watch", with no Pay button.
- **Paying for a Course:**
  - The same Payment Methods, PayMongo page and Pending screen as Plans (fake, test or live by the key).
  - Success: "You own it for good. It never expires."
  - An Order holds exactly one Plan or one Course. A Course Order copies the Course's name and price at Pay and has no days.
  - Paying adds the Exam to the Member's Target Exams if it's missing.
- **The Order ledger:**
  - A paid Course Order (including Failed → Paid and Expired → Paid) grants Course Ownership, recorded with that Order as its source, logged as "PayMongo (system)".
  - A second Order for a Course the Member already owns that gets paid anyway is recorded Paid and grants nothing. Needs attention shows "Course already owned · refund in PayMongo", with a matching Orders filter.
  - Webhook events follow Phase 4's rules: signature checked, applied once, out of order handled.
- **Existing Order screens keep working for Course Orders:** Billing's history, the Pending and success screens, the Orders list and detail show the Course's name and no access period. (Ticket 07 adds Billing's "Your Courses", the Payment Acknowledgement's line, the filter and CSV column, and the sales figures.)
- **The delete guard:** a Course can't be deleted while anyone owns it or any Order names it. The button explains why and suggests hiding it.
- **Legal v2.2** (still pending legal review): the Terms' "Payments and refunds" adds that a Course is a one-time purchase with no expiry and that a refund removes it. The version bumps through the existing mechanism, so each Member agrees once more.

**Blocked by:** 05.

**Status:** ready-for-agent

Spec: Phase 5 → "Phase 5 planning decisions" (Who does what, Buying a Course, The Order ledger for Course Orders, Hiding… deleting, Legal v2.2); Phase 4 → "Order ledger", "Phase 4 planning decisions"; stories 153, 169, 170, 171, 173, 180, 181, 184, 185.

- [ ] An Owner switches "HPGE Crash Course" to Sold separately (the confirmation shows the affected count), sets ₱1,299 on Plans & prices and turns it on sale; it appears in the Plans page's One-time purchases for CE.
- [ ] Bea buys "PSAD Masterclass" with the payments fake (Simulate paid) and sees "You own it for good. It never expires.", then the Course OWNED on the Courses screen, and watches a Lesson.
- [ ] Her Order shows in Billing's history and the Orders list with the Course's name.
- [ ] A Member on Legal v2.1 is asked to agree to v2.2 once.
- [ ] **Sad paths, each with a test:**
  - Pay is refused on the server for an owned Course, a Hidden one, one not on sale, an included one, and with no PayMongo key
  - the Order keeps the price shown at Pay after an Owner changes it
  - a second paid Order for an owned Course grants nothing and appears in Needs attention and the Orders filter
  - a duplicate paid event grants once; a bad signature changes nothing
  - an Editor can't switch how Members get a Course, or change its price or On sale (refused on the server)
  - a Course someone owns, or that an Order names, can't be deleted
  - an Access Pass still never opens a separately sold Course
  - a Member who agreed to v2.2 isn't asked again
