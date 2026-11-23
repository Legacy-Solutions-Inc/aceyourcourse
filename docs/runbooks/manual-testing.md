# Manual testing: the Admin and the Member App

A step-by-step pass over both Surfaces, by hand, in a browser. Work top to
bottom: later sections build on what earlier ones set up (for example, the
cards you add in the Admin are the cards you study in the Member App).

Tick each box as you go. When something is wrong, write it up with the
[bug template](#bug-template) at the end and carry on.

- **Part 0** gets you set up (do this first).
- **Part 1** is the Admin (`/admin`).
- **Part 2** is the Member App (`/app`).
- **Part 3** is the journeys that cross both.
- **Part 4** is the few checks that only work against the real Supabase.

Allow about 2–3 hours for Parts 1–3 the first time.

---

## Part 0. Setup

### 0.1 Pick the mode

|                | **Sample mode** (use this for Parts 1–3)          | **Live mode** (Part 4 only)        |
| -------------- | ------------------------------------------------- | ---------------------------------- |
| Data           | In memory, made up, wiped on restart or **Reset** | Your hosted Supabase project: real |
| Sign-in        | "Sign in as" list, no Google needed               | Real Google, or the password box   |
| Safe to break? | Yes                                               | No: everything you change is real  |

**Start sample mode.** Stop your normal `pnpm dev` first (two dev servers in
one folder fight over `.next`), then run:

```sh
DATABASE_URL= NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= SUPABASE_SECRET_KEY= \
  pnpm exec next dev --turbopack -p 3114
```

The empty values matter: Next never replaces a variable that is set, so this
keeps `.env`'s hosted project out. Open http://localhost:3114.

- [ ] The Admin's header shows a red **SAMPLE DATA** tag and a **Reset**
      button. If it doesn't, you're on live data: stop and recheck the command.

### 0.2 Browsers you'll need

- **Browser A:** a normal window.
- **Browser B:** a second, separate browser (or a private window) for the
  "two devices" and "two people at once" tests.
- **Phone width:** DevTools → device toolbar → 375 px wide, for the mobile
  checks.

### 0.3 The sample accounts

On either sign-in screen, choose **Continue with Google**. In sample mode
that opens a **Sign in as** list instead of Google.

**Admin** (`/admin/sign-in`):

| Account              | Email                      | What it is                              |
| -------------------- | -------------------------- | --------------------------------------- |
| Angel Rose L. Lepaña | angel@aceyourcourse.ph     | Owner: can do everything                |
| AYC Content Team     | content@aceyourcourse.ph   | Editor: no Settings, no Users           |
| Kim Reyes            | (shown in the list)        | Invited as an Editor, not signed in yet |
| Expired Invite       | expired.invite@example.com | Invite expired: should be refused       |
| Juan Dela Cruz       | (shown in the list)        | Not on the staff list: should get 403   |

**Member App** (`/app/sign-in`):

| Account              | Email                  | What it is                                         |
| -------------------- | ---------------------- | -------------------------------------------------- |
| Bea Tester           | tester@example.com     | Beta Tester with CE All-Access: the "happy" Member |
| Angel Rose L. Lepaña | angel@aceyourcourse.ph | The Owner: Staff get in too                        |
| Sam Stranger         | stranger@example.com   | Not a Beta Tester: sees "Not open yet"             |
| Lou Lapsed           | lapsed@example.com     | Beta Tester whose CE All-Access has ended          |

The labels in the "Sign in as" list never change. After you change someone in
the Admin (for example, add Sam as a Beta Tester), the label still says the
old thing. That's expected.

### 0.4 Test files

All in the repo:

| File                                                                   | Use it for                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| `e2e/fixtures/card-import.csv` + `e2e/fixtures/card-import-images.zip` | A good card import (CE, topics Beams and Columns, one image) |
| `e2e/fixtures/card-import-errors.csv`                                  | A card import with row errors                                |
| `e2e/fixtures/quiz-import.csv` (+ the same zip, it has `beam.png`)     | A good quiz import                                           |
| `e2e/fixtures/quiz-import-errors.csv`                                  | A quiz import with row errors                                |
| `test/fixtures/reviewer-pdfs/three-pages.pdf`                          | A good Reviewer PDF                                          |
| `test/fixtures/reviewer-pdfs/password.pdf`                             | A password-protected PDF (should fail, with a fix)           |
| `test/fixtures/reviewer-pdfs/corrupt.pdf`                              | A broken PDF (should fail)                                   |
| `e2e/fixtures/product-photo.png`                                       | A Product photo                                              |
| Any `.txt` or `.jpg` renamed to `.pdf`                                 | "Not a PDF" (should be refused before upload)                |

### 0.5 Good habits

- Sample data is wiped when the server restarts. **Reset** (Admin header)
  puts it back to the start without a restart.
- To switch account: **Sign out** (bottom of the side menu), then sign in as
  someone else. The Admin and the Member App share one sign-in.
- Keep DevTools' Console open. Any red error is worth a note even when the
  page looks fine.

---

## Part 1. The Admin

Sign in at http://localhost:3114/admin/sign-in.

### 1.1 Sign-in and who gets in

- [ ] Signed out, open `/admin`: you land on the sign-in screen.
- [ ] **Sign in as Juan Dela Cruz** (not Staff): the **403 · Not authorised**
      screen names the email, says nothing was changed, and shows the time.
- [ ] From the 403 screen, **Use another account** returns to sign-in.
- [ ] **Sign in as Expired Invite**: refused, with a message about the expired
      invite.
- [ ] **Sign in as Kim Reyes** (invited Editor): gets in. The invite becomes an
      active Editor (check later in Settings → Staff).
- [ ] **Sign in as Bea Tester** (via the Member App list) and then open
      `/admin`: 403. Members are never Staff.
- [ ] **Sign in as Angel** (Owner): the Overview opens. Every menu item shows:
      Overview, Pages & promo, Products & store links, Reviews & FAQs, Member
      App content, Users, Settings.
- [ ] **Sign out** works and returns to the sign-in screen. The browser's Back
      button doesn't reopen the Admin.

### 1.2 Owner vs Editor

- [ ] **Sign in as AYC Content Team** (Editor): **Settings** and **Users** are
      not in the menu.
- [ ] As the Editor, type `/admin/settings` into the address bar: refused.
- [ ] As the Editor, type `/admin/users`: refused.
- [ ] Everything else (Products, Reviews & FAQs, Pages & promo, Member App
      content) opens and saves for the Editor.

Sign back in as **Angel** for the rest of Part 1, unless a step says otherwise.

### 1.3 Overview

- [ ] The greeting uses the right time of day and today's date.
- [ ] "N things need you today" matches the number of rows under **Needs
      attention**.
- [ ] Each row's link (Add links →, Open →, Fix →) goes to the right screen.
- [ ] **+ Add product**, **+ Add Review** and **+ Add FAQ** open their editors.

### 1.4 Settings (Owner only)

**Website settings.** Keep the Website (`/`) open in another tab.

- [ ] Change the contact email and save. Reload the Website: the footer shows
      it. Change it back.
- [ ] Change a Marketplace shop link (Lazada/TikTok Shop) and save. The
      Website's store buttons use it. Change it back.
- [ ] Change a social link and a trust figure, save, and check the Website.
- [ ] **Sad paths:** an invalid email, and a link that isn't a URL, are each
      refused with a message next to the field. Nothing saves.

**Staff & Invites.**

- [ ] **+ Authorise an account**: enter a new email (`editor2@example.com`) with
      role Editor, then **Add invite**. A **Copy invite message** dialog opens.
- [ ] The copied text names the role, the Admin address, the Google email,
      and "Sign in by {date}" seven days from today.
- [ ] The new invite shows "INVITED · EXPIRES IN 7 DAYS".
- [ ] **Renew** on the expired invite: it now shows 7 days.
- [ ] **Cancel invite** asks first, then removes it.
- [ ] **Change role** switches an Editor to Owner and back.
- [ ] **Remove** asks first ("loses access right away"), then removes them.
- [ ] **Sad paths:** each shows a clear message and changes nothing:
  - [ ] an invalid email
  - [ ] an email that is already Staff or invited, typed in different capitals
        (`CONTENT@aceyourcourse.ph`)
  - [ ] removing or demoting yourself
  - [ ] removing or demoting the last Owner
- [ ] **Removal applies straight away:** in Browser B, sign in as the Editor.
      In Browser A (Owner), remove that Editor. In Browser B, click anything:
      refused.

### 1.5 Products & store links

- [ ] The list shows every Product, including Coming Soon and hidden ones.
- [ ] Search and filters narrow the list. A search with no match shows an
      empty state.
- [ ] Open a Product and change its price. Save. Reload its page on the
      Website: the new price shows. Change it back.
- [ ] Add a Lazada/TikTok link for one Product. On the Website, that Product's
      button goes to the link, not the shop page.
- [ ] **Photos:** add `product-photo.png`, drag to reorder (the first photo is
      the cover), remove one, then save. The Website shows the new photos and
      cover. A photo under 1000 × 1000 or not square gets a warning, not a
      block.
- [ ] **Sad paths:**
  - [ ] An empty name, or a price that isn't a number, is refused.
  - [ ] A file that isn't JPEG, PNG or WebP, or one over 10 MB, is refused.
- [ ] **+ Add product** creates one. Hidden products don't show on the Website.
- [ ] Delete the product you made (it asks first).

### 1.6 Reviews & FAQs

- [ ] **Reviews:** add one, edit it, hide or feature it, reorder, delete. The
      Website's `/reviews` (and Home, if featured) matches.
- [ ] **FAQs:** add one, edit it, reorder, delete. The Website's `/faq` matches.
- [ ] **Sad paths:** saving with required fields empty is refused, with
      messages.

### 1.7 Pages & promo

**Exam pages.**

- [ ] Pick an Exam (CE): edit its page text and its search title/description.
      The Website's `/exams/ce` shows the change.
- [ ] A search title that's too long (over 60 characters) is refused.
- [ ] An Exam that's **NOT ON SITE** shows a note explaining why, with a link
      that opens Products filtered to that Exam.
- [ ] **Owner only: + Add exam**: add an Exam with a Subject. It shows in the
      chips. As the Editor, the button isn't there.
- [ ] Add a Subject to an Exam, then delete it (only allowed while nothing
      uses it). Deleting a Subject or Exam that has content is refused.

**Promo banner and Announcement bar.**

- [ ] Turn the Home promo banner on, set its text, and save. The Website's Home
      shows it. Turn it off again.
- [ ] Turn the Announcement bar on and off. The Website matches.

**Site pages** (Home, Products, Reviews, About, FAQ).

- [ ] Change a page's search title, description and share image. View the
      page source on the Website: the `<title>` and `og:` tags match.
- [ ] **About:** edit a section's text and photo, then save. `/about` shows it.
      Clear a field: `/about` falls back to the default text.

### 1.8 Member App content

Open **Member App content**. Pick **CE**, then **MSTC**.

**Topics.**

- [ ] The Topics list shows each Topic's deck, quiz and Reviewer PDF state
      (VISIBLE, HIDDEN, DRAFT, PUBLISHED, EMPTY).
- [ ] Add a Topic, rename it, move it up/down.
- [ ] **Delete** shows only on an empty Topic. Topics with content say why
      they can't be deleted.
- [ ] Adding a Topic with a name that already exists in the Subject is refused.

**Card import.** Pick **CE → PSAD** (the import makes its Topics there) → **Import cards**.

- [ ] Download the template: its columns are topic, front, back, note, image.
- [ ] Upload `card-import-errors.csv`: the preview lists each bad row, naming
      the row and column (a broken formula, a missing back). **Confirm** isn't
      allowed.
- [ ] Upload `card-import.csv` + `card-import-images.zip`: the preview shows
      the cards with formulas rendered and the image matched. Confirm.
- [ ] The decks arrive **Hidden**. Missing Topics (Beams, Columns) were
      created.
- [ ] Upload the CSV without the zip: the row that names `beam.png` is flagged
      as missing its image.

**Card editor.** Open **CE → MSTC → Simple Curves → Flashcards**.

- [ ] Add a card with a formula in the back (`$T = R \tan(I/2)$`). The
      **PREVIEW** shows it rendered, as Members will see it, with a watermark.
- [ ] **Save & add next** saves and clears the form for the next card.
- [ ] **Save** with an empty front or back is refused ("ADD A FRONT TO SAVE").
- [ ] Edit a card, reorder cards, delete one (it asks first).
- [ ] Add an image to a card's back. A non-image, or one over 5 MB, is refused.
- [ ] Turn **Visible to members** off and on. Turn **Free Preview** on and off.
- [ ] **Sad path:** delete every card in a Hidden deck, then try to make it
      Visible: refused. (An empty deck can't be Visible.)

Leave Simple Curves with **at least 3 cards, Visible**: Part 2 uses them.

**Quiz import and settings.** **Import quizzes** on the same screen.

- [ ] Upload `quiz-import-errors.csv`: rows with a correct answer of "E" or
      blank, a missing choice, a missing figure or a broken formula are each
      named. Confirm isn't allowed.
- [ ] Upload `quiz-import.csv` + the zip: preview, confirm. Quizzes arrive
      **Hidden**, with the figure on the question that names it.
- [ ] Open a quiz's settings: set a passing score, shuffling, and "show answers
      after". Save. They stick after a reload.
- [ ] A passing score of **0** or **101** is refused.
- [ ] Making an empty quiz Visible is refused.

**Question editor.** Open **Simple Curves → Quiz**.

- [ ] Add 3 questions with four choices each, one correct answer and an
      explanation. Use a formula in one. The preview renders it.
- [ ] **Save & add next**, edit, reorder and delete all work.
- [ ] Saving without a correct answer, or with a choice empty, is refused.
- [ ] Make the quiz **Visible**.

**Reviewer PDFs.** **Reviewer PDFs: upload, progress and delete →**.

- [ ] Upload `three-pages.pdf`. Leave the page and come back: it shows
      progress, then ends as a **Draft** with 3 pages. (The sample renderer
      does about one page a second.)
- [ ] Upload `password.pdf`: ends **Failed**, with a reason and a fix.
- [ ] Upload `corrupt.pdf`: ends **Failed**, with a reason.
- [ ] Pick a non-PDF file: refused before anything uploads.
- [ ] Open the Draft: **Publish** is disabled until it's placed.
- [ ] Place it under **CE → MSTC → Simple Curves** (or **+ New topic**).
      Placing it on a Topic that already has a Reviewer PDF is refused.
- [ ] Preview it page by page.
- [ ] **Publish**. The Topics list now says REVIEWER PDF · PUBLISHED.
- [ ] Delete the Failed uploads.

### 1.9 Users (Owner only)

You'll come back here in Part 3. First, a look around.

**Users list.**

- [ ] The list shows Members who have used the Member App, with Target Exams,
      Access Pass end, Active Device and role.
- [ ] Search by name and by email. A search with no match shows an empty state.
- [ ] Filters (All, Active Pass, Expired, None, Staff, Beta Tester) each narrow
      the list correctly.
- [ ] Open a Member: profile, Target Exams, Access Passes, Progress, Active
      Device and its switch log all show.
- [ ] `/admin/users/00000000-0000-0000-0000-000000000000` answers 404.

**Beta Testers tab.**

- [ ] Add `not-an-email`: "Enter a valid email address".
- [ ] Add `TESTER@example.com`: "already a Beta Tester" (different capitals
      are still the same).
- [ ] Add a new email: it shows with "ADDED {date} · BY {you}".
- [ ] **Remove** someone and add them back.

**Access Passes** (on a Member's page).

- [ ] **Grant Access Pass…** for an Exam the Member doesn't have. A reason is
      required. The Exam is also added to their Target Exams.
- [ ] **Extend…** an active pass by 7 days: the end date moves 7 days on.
- [ ] **Extend…** an ended pass (Lou's): the 7 days count from **today**.
- [ ] **End access now…** asks first, needs a reason, and the pass shows ENDED.
- [ ] Each action shows in the pass's history with who, when and the reason.

**Force sign-out.**

- [ ] **Sign out this device** without a reason is refused.
- [ ] With a reason, it works (Part 3 checks what the Member sees).
- [ ] On a Member with no Active Device, it says so rather than failing.

**As the Editor:** `/admin/users`, a Member's page and the Beta Testers tab
are all refused.

### 1.10 Reset

- [ ] Change something obvious (a Product price), then **Reset**: it asks
      first, then everything is back to the start.

### 1.11 Phone width and keyboard

At 375 px wide:

- [ ] Each Admin screen fits with no sideways scrolling.
- [ ] The menu opens from a **Menu** button and closes again.
- [ ] Dialogs (invite, extend access, delete) fit and can be closed.

Keyboard only (Tab, Shift+Tab, Enter, Space, Esc):

- [ ] You can reach and use every control on Overview, a Product editor and
      the card editor.
- [ ] Focus is always visible. Esc closes dialogs.

---

## Part 2. The Member App

Sign in at http://localhost:3114/app/sign-in. Start with **Reset** in the
Admin if you want a clean run (you'll then need to re-add the cards, quiz and
Reviewer PDF from 1.8).

### 2.1 Sign-in and the beta gate

- [ ] The sign-in screen says "Use your Google account…" and shows **no**
      password box (sample mode never has one).
- [ ] **Sign in as Sam Stranger**: **Not open yet**, naming his email, with the
      support email, **Sign out** and **Back to the website**.
- [ ] As Sam, type `/app/library` in the address bar: still **Not open yet**.
- [ ] **Sign in as Bea Tester**: gets in (to consent, the first time).
- [ ] Signed out, open `/app/account`, then sign in: you land back on Account,
      not Home.

### 2.2 Consent

As Bea, the first time:

- [ ] **What we keep, and why** lists the four things kept, with links to the
      Terms of Use and Privacy Policy (version 2.0). The links open the pages.
- [ ] **Agree and continue** stays disabled with no boxes ticked, and with only
      one ticked.
- [ ] With both ticked, it continues.
- [ ] **Not ready to agree? Sign out** signs out.
- [ ] Sign out and back in: consent isn't asked again.

### 2.3 Onboarding and Target Exams

- [ ] **Hi, Bea. Let's set you up.** Exam chips (CE, ME, EE, MT, CPA) and a date.
- [ ] Start with no date: refused.
- [ ] A past date: refused.
- [ ] A future date: Home opens with "N days to go". Check the number against
      a calendar.
- [ ] **Account → + Add an exam**: add ME with a date. Home switches to ME.
- [ ] The **STUDYING FOR / SWITCH** box (top of the menu) lists both. Switching
      changes Home, the Library and the breadcrumbs.
- [ ] **Account**: change an exam date and **Save date**. Home's countdown
      updates.
- [ ] **Remove** ME (it asks first). With only one exam left, **Remove** is
      disabled, with "This is your only exam…".
- [ ] Add ME back: Home says it's restored.

### 2.4 One device at a time (Active Device)

Use Browser A and Browser B.

- [ ] Browser A: sign in as Bea and open Home.
- [ ] Browser B: sign in as Bea. Home opens.
- [ ] Browser A: click anything. **Session ended**: "signed in on another
      device", with **Sign in on this device**.
- [ ] Browser A: **Sign in on this device**. A works again, and Browser B now
      gets **Session ended** on its next click.
- [ ] Browser A: sign out. Sign in to the **Admin** as Angel, then open `/app`.
      **Use the Member App on this device** shows (the Admin doesn't claim a
      device). Confirm, and the Member App opens.
- [ ] Using the Admin in Browser B never knocks out Browser A's Member App.
- [ ] Admin → Users → Bea: the Active Device and the switch log show each
      switch, with a device label like "Chrome on macOS".

### 2.5 The Library and who can open what

As **Bea** (CE All-Access):

- [ ] **Library** shows CE's Subjects as tabs (MSTC, HPGE, PSAD) and each
      Topic's **Flashcards**, **Quiz** and **Reviewer PDF** buttons.
- [ ] Topics with nothing say "Content for this Topic is still being prepared".
- [ ] Hidden decks/quizzes and Draft Reviewer PDFs don't show.

As **Lou** (CE pass ended):

- [ ] Locked items show 🔒 and **Unlock with CE All-Access**, with a box
      explaining access comes from AYC during the beta.
- [ ] Free Preview items (Simple Curves flashcards in the sample data) still
      open.
- [ ] Opening a locked quiz shows **Access ended** with the end date and the
      support email. No questions are shown.
- [ ] Lou's progress is kept: anything Lou marked before is still counted.

### 2.6 Flashcards

As **Bea**, open **Simple Curves → Flashcards** (the cards you added in 1.8).

- [ ] "CARD 1 / N" and a progress bar. Your email and Member ID are a faint
      watermark on the card.
- [ ] Click the card, or press **Space**: it flips to the back. Formulas
      render.
- [ ] **Got it** (or →) and **Review again** (or ←) mark and move on.
- [ ] Leave halfway, come back: it reopens on the card you were on. Home shows
      it under "Continue where you left off".
- [ ] The finish screen shows "X of N got it · Y to review again", lists the
      ones to review, and **Review the Y** studies just those.
- [ ] On a phone width, swipe right = Got it, swipe left = Review again.
- [ ] A card with an image shows the image on the back.

### 2.7 Quizzes

As **Bea**, open **Simple Curves → Quiz**.

- [ ] The start screen shows the question count, passing score, Best Score
      (none yet) and past attempts.
- [ ] **Start**: one question at a time. Choose an answer, go to the next, go
      **back** and change an answer.
- [ ] Submit: score, pass/fail against the passing score, and the missed
      questions with the right answer and explanation (if "show answers
      after" is on).
- [ ] Retake and score **lower**: Best Score stays at the higher one. Both
      attempts are listed, and each opens for review.
- [ ] In the Admin, turn "show answers after" **off**. Take it again: no right
      answers or explanations are shown.
- [ ] In the Admin, delete a question. An old attempt shows it as removed.
- [ ] Double-click Submit fast: only one attempt is saved.

### 2.8 Reviewer PDFs

As **Bea**, open **Simple Curves → Reviewer PDF** (published in 1.8).

- [ ] Pages load one at a time. Each is stamped with your email and Member ID.
- [ ] Next/previous, and zoom in/out.
- [ ] Leave on page 2, come back: it reopens on page 2. Home shows "PAGE 2 OF 3".
- [ ] DevTools → Network → **Offline**, then go to the next page: "page didn't
      load · Try again". Back online, **Try again** loads it.
- [ ] In the Admin, **unpublish** it. In the Member App, it's gone from the
      Library. Publish it again and it's back.

### 2.9 Home (the dashboard)

As **Bea**, after 2.6–2.8:

- [ ] Countdown: days to the exam, with the date.
- [ ] **Study streak**: today ticked, "1 day in a row".
- [ ] **Progress by subject**: MSTC shows a % from cards marked Got it. Subjects
      with no content say "Still being prepared".
- [ ] **Continue where you left off**: the last deck and Reviewer PDF, latest
      first, each opening where you stopped.
- [ ] **Weak topics**: take the quiz and fail it. Simple Curves shows as weak.
      (A Topic is also weak with 5 or more cards on Review again.)
- [ ] A brand-new Member's Home says how progress will appear, instead of
      empty charts.

### 2.10 Account and privacy requests

As **Bea**:

- [ ] **Account** shows name, email and "Google", "Signed in on this device
      only · {device}", the exams, and "You agreed to Terms v2.0 and Privacy
      v2.0 on {date}".
- [ ] **Request a copy of my data**: says AYC will email it within 7 days, and
      shows as pending. Requesting again shows the same open request (no
      second one).
- [ ] **Delete my account**: a warning (removed within 30 days, no refund,
      progress lost) and a typed confirmation. Submitting with the wrong text
      is refused. With the right text, Account shows the request as pending and
      you stay signed in.
- [ ] **Sign out** returns to the sign-in screen.

### 2.11 Support and the "coming" screens

- [ ] **Support**: **Email Support** opens your email app addressed to the
      support email. Each common question expands.
- [ ] **Courses**, **Plans** and **Billing** each say "Coming in the beta" with
      **Back to Home**.

### 2.12 Phone width

At 375 px wide, as Bea:

- [ ] The menu becomes a **Menu** button. The exam switcher still works.
- [ ] Home, Library, the flashcard player, a quiz and the Reviewer PDF reader
      fit with no sideways scrolling.

---

## Part 3. Journeys across both Surfaces

Run these with **Browser A = Admin (Angel)** and **Browser B = Member App**.

### 3.1 Content goes live

- [ ] A: add a card to a Visible deck. B: reload the deck: the new card is
      there.
- [ ] A: hide the deck. B: the Flashcards button is gone from the Library, and
      reloading the deck's address no longer shows its cards.
- [ ] A: make it Visible again. B: it's back.

### 3.2 A new Beta Tester gets in

- [ ] B: sign in as **Sam**: **Not open yet**.
- [ ] A: **Users → Beta Testers**: add `stranger@example.com`.
- [ ] B: reload: Sam goes on to consent, then onboarding.
- [ ] A: remove Sam from Beta Testers. B: Sam's next click is **Not open yet**.

### 3.3 Access granted, extended, ended

- [ ] B: sign in as **Lou**: CE content is locked.
- [ ] A: **Users → Lou → Extend…** by 7 days, with a reason.
- [ ] B: reload the Library: a notice says "Your CE access was extended to
      {date}", with **Dismiss**, and the content is unlocked.
- [ ] A: **End access now…**. B: locked again, with a notice. Lou's progress
      is still shown.
- [ ] A: **Grant Access Pass…** for **ME** (an Exam Lou doesn't have). B: ME
      now appears in Lou's exam switcher.

### 3.4 Force sign-out

- [ ] B: signed in as Bea.
- [ ] A: **Users → Bea → Sign out this device**, with a reason.
- [ ] B: next click is **Session ended**. **Sign in on this device** works.
- [ ] A: Bea's page logs the force sign-out.

### 3.5 Privacy requests are carried out

- [ ] B: as Bea, request a data copy (if not done in 2.10).
- [ ] A: **Users → Privacy Requests**: it's listed with type, Member, date,
      due date and status.
- [ ] A: open it, **Download this Member's data**. The JSON file has the
      profile, Target Exams, consents, Access Passes and grants, progress
      (card marks, quiz attempts, pages viewed, study days), resume state and
      the device log. Nothing about any other Member.
- [ ] A: mark it done.
- [ ] B: as Lou, request deletion. A: open it and delete the account (a typed
      confirmation; the wrong text is refused). Mark it done.
- [ ] B: sign in as Lou again: Lou starts fresh (consent, onboarding). The old
      progress is gone.
- [ ] A: try to delete the account of a Staff member (the Owner signed in to
      the Member App): refused.

---

## Part 4. Live mode (your hosted Supabase)

These need the real project, so **everything here touches real data**. Use
only test accounts, undo what you change, and never delete a real Member.

Start your normal `pnpm dev` (http://localhost:3000). It has no SAMPLE DATA
tag.

### 4.1 Sign-in

- [ ] Admin: **Continue with Google** as the Owner opens the Overview.
- [ ] Admin: a Google account that isn't Staff gets the 403 screen.
- [ ] **Password box (tickets 19, 20 and 24):** under `pnpm dev`, both
      `/admin/sign-in` and `/app/sign-in` show the email and password box
      under Google, while Supabase's Email provider is on.
  - [ ] Make a test password User: Supabase dashboard → **Authentication →
        Users → Add user → Create new user**, a `+test` address of your own,
        **Auto Confirm User** ticked.
  - [ ] Sign in at `/app/sign-in` with it **before** adding it as a Beta
        Tester: **Not open yet**.
  - [ ] Add that email in **Admin → Users → Beta Testers**. Sign in again: it
        gets in, and becomes the Active Device.
  - [ ] A wrong password says the email or password is wrong, and keeps the
        email typed.
  - [ ] A User made **without** Auto Confirm is refused as unconfirmed.
  - [ ] Your Owner password User can sign in at `/app/sign-in` too (Staff get
        in).
- [ ] Member App: **Continue with Google** as a Beta Tester gets in.

### 4.2 Storage and the background job

- [ ] A Product photo upload lands in Storage: the photo's address starts with
      `https://<ref>.supabase.co/storage/v1/object/public/catalogue/`.
- [ ] A small real Reviewer PDF upload goes from Processing to Draft. If it
      sits on Processing, check that the cron job (`CRON_SECRET`) is running.
- [ ] A Member opens a published Reviewer PDF: pages are stamped.

### 4.3 Clean up

- [ ] Delete the test password Users from Supabase, and remove them from Beta
      Testers.
- [ ] Undo any Product, Settings or content changes.
- [ ] Delete test Reviewer PDFs and test cards or quizzes.

For the deployed site (Vercel), follow
[production.md → Testing on the deployed site](production.md#testing-on-the-deployed-site)
and the **Smoke checklist** in the same file.

---

## Bug template

Copy this for each problem:

```md
### <short title>

- **Where:** Admin / Member App · <screen and address, e.g. /app/library>
- **Mode:** sample / live · browser and width (e.g. Chrome, 375 px)
- **Signed in as:** <sample account, or "test password User">
- **Steps:**
  1. …
  2. …
- **Expected:** …
- **Actual:** … (error text exactly as shown; anything red in the Console)
- **Screenshot:** <attach>
```
