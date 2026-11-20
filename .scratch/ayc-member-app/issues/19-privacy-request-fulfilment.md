# 19 — Privacy Request fulfilment in the Admin

**What to build:** Owners carry out Privacy Requests from the Admin. They download a Member's data as a file for a data copy, delete the account for a deletion, and mark each request done.

- **Data copy:** "Download this Member's data" produces a JSON file of the profile, Target Exams, consents, Access Passes and grants, progress records (Card Marks, Quiz Attempts, pages viewed, Study Days), resume state and the device log. The Owner emails it from the support inbox. Downloading is logged.
- **Deletion:** "Delete this account", with a typed confirmation, removes:
  - the Supabase user
  - all their Member data
  - their Access Passes, with no refund

  Staff Activity records that a deletion happened, but not the personal data.

- **Guards:**
  - deleting is refused while the person is on the staff list ("Remove them from Staff first")
  - the last Owner can never be deleted
- **Mark done:** either type, with the date, by whom, and the request's due date (7 days for copies, 30 for deletion). Overdue requests are flagged in the list.

**Blocked by:** 16, 18.

**Status:** ready-for-agent

Spec: Phase 3 → "Privacy Requests in the Admin"; stories 133, 133q, 133r.

- [ ] An Owner downloads a Member's data, and the file has every section.
- [ ] An Owner deletes an account, the Member can no longer sign in with their old data, and the request is marked done.
- [ ] Overdue requests are flagged.
- [ ] **Sad paths, each with a test:**
  - deleting a Staff User is refused
  - deleting the last Owner is refused
  - a wrong typed confirmation is refused on the server
  - an Editor is refused every action
  - Staff Activity's deletion record has no email or name
  - the export never includes another Member's data
  - a request for an already deleted Member is handled
