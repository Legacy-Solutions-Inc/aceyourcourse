# 10 — "End granted access"

**What to build:** an Owner's "End access now" on the Member detail page removes only the granted days not yet used; paid days stay, because refunds handle those.

- **The rule:** days stack as consecutive segments, each grant, extension and Paid Order adding its days at the current end. "End access now" removes the granted days (grants and extensions) that fall after now.
- **Example:** granted 30 days on 1 Jan (to 31 Jan), bought 90 days on 10 Jan (to 1 May), ended on 15 Jan: 16 granted days are left, so access ends 15 Apr.
- **The button:**
  - no paid days left: "End access now", ending access now as before
  - paid days left: "End granted access", with the preview "Access will end on {date}. Paid days stay; refund in PayMongo to remove them."
  - no granted days left: hidden
- It still needs a reason, is logged in Staff Activity with the before and after end dates, and sends the Member a notice.

**Blocked by:** 03.

**Status:** ready-for-agent

Spec: Phase 3 → "Grants and ending access"; Phase 4 → "Phase 4 planning decisions → End access now once paid days exist"; story 151t.

- [ ] The 1 Jan / 10 Jan / 15 Jan example ends on 15 Apr, and the preview says so before confirming.
- [ ] A pass made only of grants ends now, as before.
- [ ] A pass made only of paid days has no button.
- [ ] **Sad paths, each with a test:**
  - an Editor is refused on the server
  - an empty reason is refused
  - a grant already used up removes nothing
  - an extension counts as granted days
  - a grant before and a grant after a Paid Order both lose their unused days, and the paid days stay
  - ending a pass that has already expired is handled
  - dates are right across Manila midnight
