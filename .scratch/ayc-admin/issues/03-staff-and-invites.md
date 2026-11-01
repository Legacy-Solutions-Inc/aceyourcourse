# 03 — Staff and Invites

**What to build:** An Owner manages who can use the Admin, from the Admin accounts part of Settings.

- **The list:**
  - "YOU · CAN'T BE REMOVED"
  - Owner and Editor badges
  - "LAST SIGNED IN …"
  - Invites, with "EXPIRES IN N DAYS"
- **Inviting.** "+ Authorise an account" takes a Google email and a Staff Role, then makes an Invite.
- **Actions:**
  - "Copy invite message", for sending by hand
  - Renew, which resets the 7 days
  - Cancel invite
  - Change role
  - Remove
- **The rules:**
  - The last Owner can't be removed or demoted.
  - Nobody can remove or demote themselves.
  - An email that is already Staff or already invited is refused.
- **Removal is immediate.** A removed person loses access on their next click.

**Blocked by:** 02 — Settings, and the shared save path

**Status:** ready-for-agent

Spec: Phase 2 stories 54, 56, 57, 58; Implementation Decisions → Phase 2 (Invites, Staff access, Staff Role permissions, Staff Activity). Mockup: BUILD-MAP §3.11 (ADMIN ACCOUNTS), §2 modals removeAdmin, cancelInvite, addAdmin. Conventions: §3, §4 (copy overrides), §5.

- [ ] The list follows the mockup's rows. Invites show "INVITED · EXPIRES IN N DAYS · RENEW", and an expired Invite shows "EXPIRED · RENEW".
- [ ] **Inviting.** "+ Authorise an account" opens the mockup's modal: GOOGLE ACCOUNT EMAIL and ROLE (Editor or Owner).
  - The submit button reads "Add invite". There's no "They get an email" line.
  - Its note reads: "Access starts the first time they sign in with this Google account. Invites expire after 7 days."
  - Saving adds the Invite and opens "Copy invite message".
- [ ] **"Copy invite message"** copies a ready-to-send text. It names the Staff Role, the Admin address and the Google email to sign in with, and gives the expiry date as "Sign in by {date}".
- [ ] **Renew** resets the expiry to 7 days from now. **Cancel invite** asks first, then deletes the Invite. Signing in afterwards with that email gets the 403 screen.
- [ ] **Change role** switches an active Staff User between Owner and Editor. **Remove** asks first, with the mockup's copy adjusted to "loses access right away". Their edits stay.
- [ ] **Sad paths**, each with a clear message:
  - an invalid email
  - an email that is already Staff or invited, compared case-insensitively
  - removing or demoting the last Owner
  - removing or demoting yourself
  - an Editor calling any Staff action, refused on the server
  - renewing or cancelling an Invite that no longer exists, which returns not-found
- [ ] **Removal applies on the next request.** e2e: the Owner removes the Editor while the Editor is signed in elsewhere, and the Editor's next request is denied.
- [ ] **Staff Activity** is appended for every invite, renew, cancel, role change and removal.
- [ ] **Tests:** seam behaviour tests for every rule above, the e2e journeys and axe on Settings.
