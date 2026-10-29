> Build map of the **member-app** mockup, generated on 2026-10-29 by reading the source in full. Line numbers refer to the files in `docs/mockup/member-app/`. It is a reference, not a spec: the "Ambiguities" listed here were resolved during planning, and `docs/specs/` and `docs/adr/` win wherever they disagree with this map.

# Member App v2 mockup: functional map

**File:** `docs/mockup/member-app/MemberApp_v2.dc.html` (910 lines, read in full). The markup is in lines 1–698. The logic is a `DCLogic` class: `liveVals()` at L726–778 and `renderVals()` at L780–906.

**Sibling files.** None hold app logic.
- `_template.html` is only a wrapper. It sets `mobile=true` when `innerWidth < 760`. It also catches clicks on links ending in `*.dc.html` and sends them to "AceYourCourse Website.html", or to "AceYourCourse Admin.html" when the link name starts with `Admin`. So the Legal and FAQ pages live in the Website mockup.
- `8ca87b12…js` maps assets and images, and defines a lazy `window.__ayc` loader for aycData.
- `be97c554…js` holds the motion presets.
- `3e368403…js` is the dc-runtime.

**Key fact: the mockup never uses aycData.js.** There are no references to `aycData`, `DIGITAL`, `PRODUCTS` or `STORES`. Every value in the app is hardcoded. The only overlap is vocabulary: exam codes and boards (CE/CELE, ME/MELE) and subject codes and names (MSTC, HPGE, PSAD, plus PIP, MATH and MD for ME) match aycData's `EXAMS`, `SUBJECT_NAMES` and `EXAM_INFO`. Nothing in the app links physical marketplace purchases to app access.

---

## 1. Purpose and audience

- **Who it's for:** Filipino board-exam reviewees. The sample user is "Juan Dela Cruz", a CE/CELE reviewee who also has ME added. Copy mixes English and Tagalog: "Hi, Juan. Kaya mo 'to." (roughly "You can do this", L157, L569).
- **What it is:** a paid, digital-only study app. The sign-in hero reads "Your reviewer, one card at a time." (L18) and lists three things:
  - "Flashcards, quizzes, and reviewers by subject and topic"
  - "Video courses that resume where you left off"
  - "A countdown to your board exam date" (L20–22)
- **Brand line:** "BUILT BY BOARD PASSERS · ILOILO CITY" (L25).
- **Business model:** time-boxed "All-Access" passes per exam, plus one-time course purchases, paid through PayMongo. It is not tied to the Shopee, Lazada or TikTok physical products.

## 2. Screens and navigation

The design tool's `screen` prop (L700) lists 28 states: `signin, consent, newUser, dashboard, endingSoon, switchExam, library, flashcards, deckDone, quizStart, quiz, score, reviewer, loadError, courses, course, plans, account, billing, receipt, support, session, loading, emptyTopic, expired, payPending, payFailed, paySuccess`. There is also a `mobile` boolean. The desktop preview is 1280×820, and mobile has a min-height of 844.

**The app shell (L115–697)** wraps every screen except `signin`, `consent` and `session` (L789).

- **Desktop:** a 272px left sidebar (L119–139) holds, top to bottom:
  - the brand logo
  - an **exam switcher card**: "STUDYING FOR · SWITCH ▾ / CE · CELE / {days} days to the exam"
  - seven numbered nav items
  - a streak button, "▲ 6-DAY STREAK … STUDY TODAY", which goes to the dashboard (desktop only, L132)
  - a footer with the name, the email, a "CE ALL-ACCESS" badge and "Sign out"
- **Nav items (L794):**

  | # | Label | Hint |
  |---|---|---|
  | 01 | Home | "Countdown, streak and progress" |
  | 02 | Library | "Flash cards, quizzes, reviewers" |
  | 03 | Courses | "Video lessons" |
  | 04 | Plans | "Buy or renew access" |
  | 05 | Billing | "Payments and receipts" |
  | 06 | Account | "Exam date and privacy" |
  | 07 | Support | "Contact us" |

- **Which nav item is highlighted (L795–796):**
  - Library: flashcards, quiz, score, reviewer, emptyTopic, expired, quizStart, deckDone, loadError
  - Courses: course
  - Billing: receipt
  - Plans: payPending, payFailed, paySuccess
  - Home: endingSoon, switchExam, loading, newUser
- **Mobile:** there is no sidebar.
  - A sticky "Menu" button (FAB) sits at the bottom right (L693). It shows only on non-"focus" screens.
  - It opens a **drawer** (L89–113) with the same content minus the streak button. The drawer slides in over a scrim. Escape, ✕ or tapping the scrim closes it (L705).
- **Focus screens** (L788) are flashcards, quiz, score, reviewer, course, emptyTopic, expired, quizStart, deckDone, loadError and receipt.
  - On desktop they show a breadcrumb, "LIBRARY / MSTC · FLASHCARDS" (L151–153).
  - On mobile they show a back bar with "←" and a two-line crumb (L142–147).
  - Back goes to Library, except receipt (back to Billing) and course (back to Courses) (L890).
- **Exam switcher dropdown** (desktop L61–66, mobile L67–72):
  - CE · "Civil Engineering · All-Access until 12 Jan 2027 · exam 21 Nov"
  - ME · "Mechanical Engineering · All-Access until 9 Nov 2026 · exam 8 Feb 2027"
  - A check mark shows the current exam, and "+ Add an exam" goes to Plans.
  - The `switchExam` state is just the dashboard with this menu open.
- **Unused code:** `topNav`, `tabNav` (a 4-tab mobile bar: Home/Library/Courses/Account), `mTop`, `mTabs`, `stats`, `streakLabel` and `examChip` are computed (L798–799, L881–883) but never rendered. They look like leftovers from a v1 top-bar and tab-bar nav.

**How each state is reached in the mock:**
- signin → "Continue with Google" → consent → "Agree and continue" → newUser → "Start my countdown" → dashboard.
- Pay → payPending → after 2.6 s, paySuccess, or payFailed if the method is Card (L900).
- Reviewer: "Next" from page 4 to page 5 triggers loadError once (L755).
- **Only reachable through the design-tool prop:** session, loading, emptyTopic, expired, endingSoon. Nothing in the app navigates to them.

## 3. Per-screen contents and interactions

**Sign in (L13–37)**
- "Sign in / Use your Google account. No separate username or password."
- Button: **Continue with Google** → consent.
- Notice: "One device at a time. Signing in here signs out any other device on your account."
- "By continuing you agree to the Terms and Privacy Policy", with links to `Legal.dc.html?doc=terms|privacy`.

**Consent (L39–59)**
- Header "BEFORE YOU START", then "What we keep, and why":
  1. "Your Google name and email, to sign you in and show your watermark."
  2. "Your exam, exam date, and study progress, to run your countdown and dashboard."
  3. "Your payment history. Card details stay with PayMongo; we never see them."
  4. "Which device is signed in, so only one device is active at a time."
- "We don't sell your data. You can ask for a copy or delete your account anytime."
- Two checkboxes, shown pre-checked as static visuals:
  - "I agree to the Terms of Use"
  - "I've read the Privacy Policy and agree to the processing described above"
- Button: **Agree and continue**.
- Footer: "WE SAVE THE DATE AND VERSION YOU AGREED TO."

**New user (L503–520)**
- "WELCOME / Hi, Juan. Let's set you up."
- STEP 1 · YOUR EXAM, "When is your board exam?":
  - Exam pills CE/ME/EE/MT/CPA. They are display-only spans with no click handler.
  - A date input, default 2026-11-21.
  - **Start my countdown** → dashboard.
- STEP 2 · ACCESS, "You don't have a plan yet":
  - "Your flashcards, quizzes, reviewers, and courses unlock as soon as you buy a plan. Progress starts counting from your first card."
  - **See plans** → Plans.

**Dashboard (L155–226)**
- Header: "Hi, Juan. Kaya mo 'to." and "CE ALL-ACCESS · ACTIVE UNTIL 12 JAN 2027".
- **Countdown card:**
  - "CELE BOARD EXAM" with a **Change date** link → Account.
  - The day count is live, computed from 21 Nov 2026 (L800).
  - A 12-segment bar with 7 segments filled.
  - "SAT · 21 NOV 2026 · DATE SET BY YOU".
- **Ending-soon block** (endingSoon only, L166–172):
  - An access bar with 11 of 12 segments filled.
  - "ACCESS ENDS IN 5 DAYS · Your plan ends 25 Oct, 27 days before your exam."
  - **Renew to cover your exam** → Plans.
- **Streak card:**
  - "STUDY STREAK · LAST 7 DAYS / 6 days in a row".
  - Seven boxes FRI…TODAY: six checked, today shown dashed.
  - "Study anything today to make it 7. Your best is 11 days."
- **Continue where you left off** (L183–201):
  - Hero card: "FLASHCARDS · LAST OPENED 2H AGO · MSTC / Simple Curves", a 25% bar, "CARD 12 OF 48", **Continue →** (flashcards).
  - Second card: "VIDEO LESSON · PSAD · Balanced steel ratio · 12:40 OF 24:10", **Resume** (course).
  - Third card: "REVIEWER · MSTC · Simple Curves reviewer · PAGE 4 OF 36", **Open** (reviewer).
- **Progress by subject:**
  - Summary line: "312 / 1,040 CARDS · 76% QUIZ AVG · 9 / 32 LESSONS".
  - Ring cards: MSTC 42% ("148 cards · 6 quizzes · 2 reviewers"), HPGE 27%, PSAD 21% ("68 cards · 4 quizzes · 9 lessons").
  - Clicking a ring opens Library on that subject's tab.
- **Weak topics to review** ("BASED ON YOUR QUIZ SCORES", L887):
  - MSTC Sub-chord deflection, 40%: "LAST QUIZ 4 / 10 · 7 CARDS MARKED REVIEW AGAIN"
  - HPGE Shear strength, 50%
  - PSAD Steel design, 60%: "LESSON NOT STARTED"
  - Buttons on each: **Review cards** → flashcards, **Retake quiz** → quizStart.

**Library (L228–261)**
- "LIBRARY · CE · CELE / Subjects and topics".
- Subject tabs MSTC, HPGE, PSAD, with the full subject name underneath.
- Topic rows: number, name, progress bar "{n}% DONE", and three buttons:
  - **Flashcards · {cards}** → flashcards
  - **Quiz · 10** → quizStart
  - **Reviewer · {pages}p** → reviewer
- Every topic opens the same "Simple Curves" demo.
- Topics (L814–817):
  - **MSTC:** Algebra, Trigonometry, Analytic Geometry, Calculus, Surveying, Simple Curves
  - **HPGE:** Fluid Properties, Hydrostatics, Hydrodynamics, Soil Properties, Shear Strength, Consolidation
  - **PSAD:** Statics, Strength of Materials, Structural Analysis, Reinforced Concrete, Steel Design, Timber Design
- "NOT IN YOUR PLAN": dashed tiles "🔒 ME / EE / MT / CPA", each with **Unlock** → Plans (L822).

**Flashcards (L263–292, logic L729–734, L713–725)**
- Title "Simple Curves", position "CARD x / 10", and a tick bar: orange = current, blue = got, red = again.
- The card is 3:2. Its header reads "MSTC · TRANSPORTATION / FRONT|BACK".
  - The front shows the term plus "Tap to see the formula".
  - The back shows the formula plus a note.
- The user's email is tiled diagonally across the card as a watermark.
- **Interactions:**
  - Tap to flip.
  - Drag past 90px: right = "GOT IT ✓", left = "REVIEW AGAIN ↺". Overlay hints appear while dragging.
  - Buttons: ←, **Review again**, **Got it**, →. The arrows move without marking a card.
  - **Finish deck →**.
  - Keyboard: ← again, → got it, space flips.
- Marking the last card → deckDone.
- Copy: "Marked cards count toward your progress."
- Sample cards include "Length of curve, arc basis / L = 20I / D / I in degrees, 20 m station" and "Degree of curve, arc basis / D = 1145.916 / R".

**Deck done (L651–660)**
- "DECK FINISHED · SIMPLE CURVES / 41 of 48 cards: got it", with a split bar.
- "7 TO REVIEW AGAIN", then chips (Tangent distance, External distance…).
- Buttons: **Review the 7**, **Take the quiz**, **Back to topics**.

**Quiz start (L635–649)**
- "MSTC · PRACTICE QUIZ / Simple Curves".
- Facts: QUESTIONS 10 · ABOUT 15 min · YOUR BEST 80%.
- Rules:
  - "One question at a time. You can go back before you submit."
  - "No time limit. Your best score counts toward your progress."
  - "Previous attempts: 60% · 70% · 80%"
- Buttons: **Start quiz**, **Review flashcards first**.

**Quiz (L294–315, L736–750)**
- "Simple Curves · Practice quiz", "QUESTION n / 10", a tick bar, and four options A–D.
- The 10 questions are computed numerically from R and I values.
- **← Previous** and a primary button whose label changes:
  - "Pick an answer" (disabled until an option is chosen)
  - "Next question →"
  - "Finish quiz" on the last question
- Text selection is disabled.

**Score (L317–342)**
- "QUIZ COMPLETE · SIMPLE CURVES / {n} / 10".
- Badge: "80% · BEST SO FAR", or "… · BEST IS 80%" when the score is below 8 (L832).
- "Previous attempts: 60% · 70%".
- Buttons: **Retake quiz** (resets to Q1), **Review flashcards**.
- Tabs:
  - "MISSED · n": each card shows "Q# · INCORRECT", the question, "Your answer:" and "Correct:".
  - "ALL ANSWERS · 10": ✓/✗ rows.

**Reviewer (L344–370)**
- "MSTC Reviewer · Simple Curves".
- Zoom − / {pct} / +, from 75% to 150% in 25% steps.
- One page shown at a time at 8.5:11, labelled "PAGE IMAGE · CLIENT PDF", with the email watermark.
- **← Prev**, "PAGE n / 36", **Next →**.

**Load error (L676–689)**
- "PAGE 5 DIDN'T LOAD / Looks like your connection dropped / Pages load one at a time and aren't saved on your device, so you need a connection to keep going."
- **Try again**, plus Prev / Next with Next dimmed.

**Courses (L575–593, L860–868)**
- "Your {exam} courses", shown as cards. Each card has a subject block, a tag, meta, progress and a CTA.
- CE courses:
  - "PSAD Masterclass · 3 MODULES · 32 LESSONS · OWNED", 9/32, "Continue: Balanced steel ratio →"
  - "Surveying & Curves Lectures · 2 MODULES · 18 LESSONS · IN CE ALL-ACCESS", tag "IN YOUR PLAN", "Start course →"
  - "HPGE Crash Course · 4 MODULES · 26 LESSONS", tag "NOT OWNED", LOCKED, "🔒 Unlock for ₱1,299 →" → Plans
- ME courses:
  - Power & Industrial Plant Lectures (3/24, "Continue: Rankine cycle →")
  - Engineering Mathematics for MELE
  - Machine Design Crash Course (locked, ₱1,299)

**Course player (L372–410, L759–772)**
- A 16:9 video area with the watermark, a play/pause circle, and a status label: "RESUMING AT 12:40", "PLAYING · mm:ss" or "TAP TO PLAY".
- Scrubber, a "1×" speed control and a fullscreen ⛶ icon.
- Crumb "PSAD MASTERCLASS · MODULE 2 · LESSON 3" and the lesson title.
- Note text, which depends on state:
  - "You stopped here 2 days ago. The video picks up at 12:40."
  - "You finished this lesson. Watch it again anytime."
  - "Starts from the beginning."
- Buttons:
  - "← {previous lesson title}"
  - "Mark complete · next lesson →", or "Mark complete · finish course", which returns to Courses
- **Side panel:** "PSAD Masterclass", a progress bar, "{n} / 8 IN THIS PREVIEW", and modules with lessons and durations. Icons: ▶ current, ✓ done, ○ to do.
  - Module 1 Statics Refresher: Equilibrium of rigid bodies 18:22; Trusses 21:05
  - Module 2 Reinforced Concrete: Whitney stress block; Singly reinforced beams; Balanced steel ratio 24:10; Doubly reinforced
  - Module 3 Steel Design: Tension members; Compression members
- Any lesson can be clicked. There is no sequential locking.

**Plans (L412–450, L838–847)**
- "PLANS / Choose your access / Pay once for a fixed period. Nothing renews automatically."
- Exam pills CE/ME/EE/MT/CPA.
- Header: "{EXAM} ALL-ACCESS · FLASHCARDS, QUIZZES, REVIEWERS" (CE adds ", COURSES"; L899).
- Plans are radio rows:

  | Exam | Duration | Price | Note |
  |---|---|---|---|
  | CE | 1 month | ₱499 | "Until 18 Nov 2026" |
  | CE | 3 months (default) | ₱1,299 | "Until 18 Jan 2027 · covers the November CELE" |
  | CE | 6 months | ₱2,299 | "Until 18 Apr 2027" |
  | Other exams | 1 month only | ₱449 | "Until 18 Nov 2026" |

- CE only, "ONE-TIME PURCHASE": **PSAD Masterclass**, "Video course only · yours to keep", ₱1,499.
- ORDER SUMMARY: item and price, then "UNTIL 18 JAN 2027 · NO AUTO-RENEWAL" or "ONE-TIME · NO EXPIRY".
- PAY WITH: QR Ph / GCash / Maya / Card.
- Button: **Pay {price} with PayMongo**.
- "You'll finish payment on PayMongo's secure page. We never see or store your card details."

**Pay pending (L546–554):** a 4-step bar. "CONFIRMING PAYMENT / Waiting for PayMongo to confirm your {method} payment / This usually takes under a minute. Keep this page open. Your access starts as soon as the payment is confirmed." Then "CE ALL-ACCESS · 3 MONTHS · ₱1,299 / REF AYC-10483".

**Pay failed (L556–564):** "PAYMENT DIDN'T GO THROUGH / Your card was declined / You weren't charged. Try again, or pay with QR Ph, GCash, or Maya instead." Buttons: **Try another method** → Plans, **Email support**.

**Pay success (L566–574)**
- "✓ PAYMENT CONFIRMED / You're in. Kaya mo 'to."
- Then either:
  - "It's active until 18 Jan 2027. It won't renew on its own. We'll remind you a week before it ends." (time-boxed plan)
  - "You own it for good. It never expires." (one-time course)
- Footer: "₱1,299 · QR PH · REF AYC-10483 · RECEIPT IN BILLING".
- **Start reviewing** → Library.

**Billing (L452–477, L848–855)**
- Active cards:
  - "CE All-Access · 3 months", tag ACTIVE: "Until 12 Jan 2027 · 86 days left · renews only if you renew", with **Renew now**.
  - "PSAD Masterclass", tag OWNED: "One-time purchase · no expiry".
- Purchase history rows show item, date · method · ref, a status badge, the amount, and **Receipt** for paid rows only:

  | Item | Date | Method | Ref | Status | Amount |
  |---|---|---|---|---|---|
  | CE All-Access 3 mo | 14 Oct 2026 | QR Ph | AYC-10482 | PAID | ₱1,299 |
  | PSAD Masterclass | 02 Sep 2026 | GCash | AYC-09917 | PAID | ₱1,499 |
  | CE All-Access 1 mo | 01 Sep 2026 | Card | AYC-09903 | FAILED | ₱499 |
  | CE All-Access 1 mo | 12 Aug 2026 | Maya | AYC-09311 | PAID | ₱499 |

**Receipt (L662–674)**
- Buttons: **← Billing**, **Print or save as PDF** (`window.print`).
- "PAYMENT RECEIPT · AYC-10482 · 14 OCT 2026".
- BILLED TO: name and email. FROM: "AceYourCourse, Iloilo City, Iloilo".
- Line item: "CE All-Access · 3 months — Access 14 Oct 2026 – 12 Jan 2027 · no auto-renewal — ₱1,299.00". TOTAL PAID ₱1,299.00.
- METHOD "QR Ph via PayMongo", PAYMONGO REF "pi_3VbN8sQ1kLx7MwR2pT5e", STATUS PAID.
- "Questions? Email support@aceyourcourse.ph."

**Account (L595–633)**
- **PROFILE:** avatar "JD", name, "{email} · Google", "Signed in on this device only · Chrome on Android", **Sign out**.
- **YOUR EXAMS:**
  - CE "Civil Engineering · CELE", exam date Sat 21 Nov 2026
  - ME "Mechanical Engineering · MELE", Mon 8 Feb 2027
  - Each has **Edit**, which opens an inline date input and **Save**.
  - "+ Add another exam" → Plans.
- **PLANS & RECEIPTS:** the active list, **Renew or buy**, **Billing & receipts**.
- **PRIVACY:**
  - "You agreed to the Terms and Privacy Policy on 12 Aug 2026." Links to the Privacy Policy and Terms of Use.
  - **Request a copy of my data** → "✓ REQUEST SENT · WE'LL EMAIL A COPY TO … WITHIN 7 DAYS".
  - **Delete my account** → a confirmation box: "Your progress, plans, and receipts are removed within 30 days. Plans you paid for aren't refunded. This can't be undone." Buttons **Delete my account** (→ signin) and **Keep my account**.

**Support (L479–492)**
- "Email us about payments, access, or your account. Include the email you sign in with so we can find you."
- **Email Support** opens a `mailto:support@aceyourcourse.ph?subject=AceYourCourse support`.
- COMMON QUESTIONS link to the Website FAQ:
  - "Does my subscription renew automatically?"
  - "Why was I signed out on my other device?"
  - "My payment went through but I don't have access"

**Signed out elsewhere (L74–87)**
- "SESSION ENDED / You were signed in on another device / Your account {email} was just opened on another device, so this one was signed out. Only one device can be active at a time."
- "NEW DEVICE · Chrome on Android · Today, 9:42 PM".
- **Sign in on this device**, and "Wasn't you? Email support".

**Loading (L493–501):** skeleton blocks and "LOADING YOUR DASHBOARD…".

**Empty topic (L522–530)**
- "PSAD · TOPIC 06 / Timber Design / Nothing here yet / Flashcards, the quiz, and the reviewer for this topic are still being prepared. They'll show up here automatically."
- **Back to PSAD topics**.

**Expired (L532–544)**
- Shown in place of a flashcard.
- "🔒 PLAN ENDED / Your CE All-Access ended on 12 Jan 2027 / Renew to keep reviewing. Your progress is saved: 312 cards marked, 14 quizzes taken."
- **Renew access**, **View billing**.

## 4. Entities and fields

All of the values below are hardcoded mock data. aycData supplies nothing at runtime.

- **Member:**
  - name "Juan Dela Cruz", initials "JD"
  - email "juan.delacruz@gmail.com" (L786)
  - authProvider "Google"
  - consent record
  - active device session
  - streak
  - exams list
- **Consent record:** termsVersion, privacyVersion, agreedAt ("12 Aug 2026"). From "WE SAVE THE DATE AND VERSION YOU AGREED TO."
- **Device session:** deviceLabel ("Chrome on Android"), signedInAt ("Today, 9:42 PM"), plus one active session per member.
- **Exam (catalog):** code, board, name. These match aycData `EXAMS`. Plans offers only CE, ME, EE, MT and CPA, which are aycData's non-"soon" exams.
- **Member exam (enrolment):** examCode, examDate (ISO, user-set, e.g. CE 2026-11-21, ME 2027-02-08), access summary ("All-Access until …"). The selected or "studying for" exam is state (`exam` index).
- **Subject:** code, name, examCode, progress % (MSTC 42), and counts ("148 cards · 6 quizzes · 2 reviewers"). Names match aycData `SUBJECT_NAMES` and `EXAM_INFO`.
- **Topic:** subject, number ("06"), name, flashcard count (e.g. 32–61), quiz question count (10), reviewer pages, the member's % done, and content-ready status (the empty state).
- **Flashcard deck:** topic, title, label "MSTC · TRANSPORTATION" (subject plus an area or category), cardCount (48).
- **Flashcard:** front (term), back (formula), note (e.g. "c = sub-chord length").
- **Card mark (member × card):** `got` | `again`, plus a deck position for resume ("CARD 12 OF 48").
- **Quiz:** topic, questionCount (10), estMinutes (15), no time limit, the member's best score.
- **Question:** text, four options (A–D), correct index.
- **Quiz attempt:** answers per question, score (8/10), percent, a best flag, and history (60/70/80%).
- **Reviewer document:** title ("MSTC Reviewer · Simple Curves"), pageCount (36), and pages as images rendered from a client-supplied PDF. Per member: last page (4) and zoom.
- **Course:** examCode, subject, title, modules and lessons counts, and access type:
  - OWNED: a one-time purchase
  - IN YOUR PLAN: included in All-Access
  - NOT OWNED: locked, with a price such as ₱1,299
- **Module:** order and title ("MODULE 2 · REINFORCED CONCRETE").
- **Lesson:** title, duration ("24:10"), video. Per member: status done/now/todo, resume position (12:40), lastWatched ("2 days ago").
- **Plan / digital product:**
  - Exam All-Access: examCode, duration (1/3/6 months), price, and an included scope (flashcards, quizzes and reviewers, plus courses for CE).
  - One-time course product: PSAD Masterclass, ₱1,499.
- **Entitlement:** product name, tag (ACTIVE or OWNED; expired is implied), startDate, endDate ("Until 12 Jan 2027"), daysLeft (86), elapsed bar, renewable flag.
- **Order / payment:**
  - item, date, method (QR Ph, GCash, Maya or Card), amount
  - our reference "AYC-#####", which runs sequentially (10482 → 10483)
  - PayMongo reference ("pi_…", a payment intent)
  - status: PENDING, PAID or FAILED
- **Receipt:** number (equals the order reference), date, billed-to name and email, seller ("AceYourCourse, Iloilo City, Iloilo"), line item with access window, total, method, PayMongo reference, status.
- **Activity and resume item:** kind (FLASHCARDS, VIDEO LESSON or REVIEWER), subject, title, position, lastOpened ("2H AGO").
- **Streak:** current (6), best (11), last-7-days grid.
- **Derived dashboard aggregates:**
  - cards marked out of total (312 / 1,040)
  - quiz average (76% across 14)
  - lessons done (9 / 32)
  - weak topics (topic, last quiz score, cards to review, lesson status)
- **Privacy requests:** data export (emailed within 7 days) and account deletion (purged within 30 days).
- **Reminders:** a renewal reminder "a week before it ends", and an in-app ending-soon banner ("ACCESS ENDS IN 5 DAYS").

## 5. Statuses and lifecycles

- **Account:**
  1. Google sign-in.
  2. Consent. The member must agree before using the app.
  3. Onboarding: set exam and date.
  4. Active.
  5. Deletion requested, then purged within 30 days.
- **Device session:** active, then ended when the same account signs in on another device. The old device sees the SESSION ENDED screen.
- **All-Access entitlement:**
  1. None ("You don't have a plan yet").
  2. Payment pending.
  3. Active.
  4. Ending soon (in-app banner at about 5 days, email reminder about 7 days before).
  5. Ended. Content is locked, "🔒 PLAN ENDED", and progress is kept.
  6. Renewing means buying a new fixed period. There is no auto-renew.
- **One-time course:** NOT OWNED (locked), then OWNED (permanent).
- **Payment:**
  1. The member selects a plan and method, then clicks Pay.
  2. They are sent to PayMongo's hosted page.
  3. PENDING: "Waiting for PayMongo to confirm".
  4. PAID, which grants access right away, or FAILED ("You weren't charged").
  5. Receipts exist only for PAID payments.
- **Card:** unmarked, then `got` or `again`. A card can be re-marked. Finishing the deck shows a got/again summary.
- **Quiz:** not started, in progress (can go back), submitted, then scored. The best score counts toward progress.
- **Lesson:** to do, in progress (resume time), done. Done is set only by the "Mark complete" button. It does not appear to be set automatically by watching.
- **Topic content:** "still being prepared" (empty) until published, then it "show[s] up here automatically".
- **Reviewer page:** loading, loaded or failed. Failed shows "Try again". Pages are never cached on the device.

## 6. Business rules (explicit or implied)

1. **Access is sold per exam**, as "{EXAM} All-Access" for a fixed period, through PayMongo. Other exams show as "NOT IN YOUR PLAN" with "Unlock" (L252–258).
2. **No auto-renewal.** "Pay once for a fixed period. Nothing renews automatically." (L413), "renews only if you renew" (L849), and "no auto-renewal" on the receipt.
3. **Pricing:** CE ₱499 / ₱1,299 / ₱2,299 for 1 / 3 / 6 months. Other exams ₱449 for 1 month. PSAD Masterclass ₱1,499 one-time. Locked crash courses "Unlock for ₱1,299".
4. **Plan end dates are framed around the exam date.** The 3-month plan "covers the November CELE". The ending-soon banner computes the gap: "Your plan ends 25 Oct, 27 days before your exam" and nudges "Renew to cover your exam".
5. **Some courses are included in All-Access ("IN YOUR PLAN") and others are separate one-time purchases ("OWNED" / "NOT OWNED").** Only CE All-Access lists "COURSES" in its scope (L899).
6. **One active device per account.** A new sign-in kicks the old session (L32, L49, L74–87).
7. **Anti-piracy measures:**
   - A watermark with the member's email is tiled over flashcards, reviewer pages, video and the error page (L280, L361, L379, L679, L895).
   - Text selection is disabled on cards, quiz and reviewer.
   - Reviewer pages are images streamed one at a time and not stored on the device (L683).
8. **Progress:**
   - Cards count when marked; the totals use "got it".
   - The quiz's best score counts. Note that the dashboard shows an *average*.
   - Lessons count when marked complete.
   - The streak counts days with any study ("Study anything today").
   - Progress is kept after a plan expires, and "starts counting from your first card".
9. **Weak topics** are derived from quiz scores. The examples are 40–60%, but no threshold is given.
10. **No refunds on account deletion** (L630). Data export is delivered by email within 7 days, and deletion completes within 30 days.
11. **The exam date is user-entered** ("DATE SET BY YOU") and editable per exam in Account.
12. **Adding an exam** ("+ Add an exam" / "+ Add another exam") routes to Plans. This implies an exam is added by buying access, but onboarding lets you set an exam without a plan.
13. **There is no rule linking physical marketplace purchases to app access.** No order-number entry, code redemption, or use of aycData's `DIGITAL` list appears anywhere.

## 7. Auth and onboarding

- **Sign-in method:** Google OAuth only. "No separate username or password." There is no email/password, phone/OTP or Facebook option.
- **Profile fields:** Google name, email and avatar initials. Nothing is edited in the app except exam dates.
- **Consent gate:** both checkboxes are required (Terms, and Privacy plus processing). The agreed date and the version agreed to are stored.
- **Onboarding:** pick an exam (the pills are not interactive in the mock), set the exam date, "Start my countdown", then an optional "See plans". There is no email verification beyond Google's.
- **Sign out:** in the sidebar, the drawer and Account.
- **Re-auth:** on the session-ended screen, "Sign in on this device" goes straight to the dashboard. A real build would re-run Google auth there.

## 8. Integrations implied

- **Google OAuth** for identity.
- **PayMongo:**
  - hosted checkout with QR Ph, GCash, Maya and Card
  - payment-intent references (`pi_…`)
  - asynchronous confirmation, most likely a webhook ("Waiting for PayMongo to confirm… Keep this page open")
  - failure handling ("You weren't charged")
- **Transactional email:**
  - renewal reminder a week before a plan ends
  - data-export delivery
  - support through `mailto:support@aceyourcourse.ph`
- **Device and user-agent detection** for labels such as "Chrome on Android", and single-session enforcement. Realtime or polling is implied so the kicked device learns it was signed out.
- **Video hosting and streaming** with resume position and playback speed, with a watermark overlay. This implies a protected or signed-URL video provider.
- **PDF-to-page-image pipeline** for reviewers ("PAGE IMAGE · CLIENT PDF"), served page by page.
- **Content management / admin:** "still being prepared… show up here automatically". The template also routes links to an "AceYourCourse Admin.html" mockup.
- **Website pages** for Legal (`?doc=terms|privacy`) and the FAQ, which live in the Website mockup.
- **Browser print** for receipt PDFs.
- **Not present:** Shopee, Lazada or TikTok order linking, SMS, push notifications, analytics, and offline mode.

## 9. Ambiguities and open questions

1. **Physical-to-digital link is missing.** aycData's `DIGITAL` product list is never used. Does buying physical flash cards on Shopee, Lazada or TikTok grant any app access, for example through a code inside the box, order-number verification, or a discount? The mockup assumes PayMongo purchases only.
2. **Support email conflict.** The app uses `support@aceyourcourse.ph`. aycData `CONTACT` uses `aceyourcourseinc@gmail.com`.
3. **Plan durations don't match.** The receipt shows 3 months as 14 Oct–12 Jan, which is 90 days. Plans shows 3 months as "Until 18 Jan 2027", a calendar month count from about 18 Oct. Are months 30-day blocks or calendar months?
4. **What renewing an active plan does.** Does it extend from the current end date, or start a new period now? Can periods stack? Is any proration needed?
5. **Non-CE exams look like placeholders.**
   - They offer only a 1-month plan at ₱449, and Plans omits "COURSES" from their scope.
   - Yet the ME courses page lists ME courses as "IN ME ALL-ACCESS".
   - The switcher says ME access runs until 9 Nov 2026, but Billing and purchase history show no ME purchase, and Library lists ME as "NOT IN YOUR PLAN".
6. **Hardcoded values that should change with the selected exam.** The sidebar badge "CE ALL-ACCESS", the dashboard header, the countdown label "CELE BOARD EXAM" and "LIBRARY · CE · CELE" are all fixed. Switching exam only changes the switcher card and the Courses list. Is the dashboard and countdown per exam?
7. **How locked courses are bought.** HPGE Crash Course is "Unlock for ₱1,299", the same price as 3-month All-Access, and links to Plans, which doesn't list it. Only PSAD Masterclass is shown as a one-time product. Is there a course catalog with per-course pricing?
8. **Count inconsistencies.** The live flashcard demo has 10 cards, the static data says 48 and Deck done says 41 of 48. The course preview shows 8 lessons against "32 LESSONS". The sidebar course bar is fixed at 28%. Quiz start lists previous attempts "60·70·80" while the score screen shows "60·70".
9. **Progress metric definitions.** Is it the best quiz score or the average ("76% QUIZ AVG")? How are subject % and topic "% DONE" calculated across cards, quizzes, reviewers and lessons? Does reviewer reading count? What threshold makes a topic "weak"?
10. **Unclear countdown bars.** What do the 12 segments on the countdown card (7 filled) and on the ending-soon access bar represent? Weeks of the plan, or weeks until the exam?
11. **Expired state scope.** It is shown only on a flashcard. Do quizzes, reviewers and included courses lock too? Do OWNED courses stay accessible? (Presumably yes.) Can expired members still see the dashboard and progress?
12. **Free tier or trial.** None is shown. New users see "You don't have a plan yet". Should there be sample cards or a preview?
13. **Card always fails in the mock** (L900), and the failure copy is hardcoded to "Your card was declined". The real design needs method-specific failure copy, plus states for abandoned, expired and timed-out payments. The pending screen has no timeout or "still waiting" fallback, even though the FAQ mentions "payment went through but I don't have access".
14. **Receipt compliance.** It is titled "PAYMENT RECEIPT" with no TIN, VAT breakdown or BIR official receipt or invoice number. Are BIR-compliant invoices needed?
15. **Consent mock-ups.** The checkboxes render pre-checked and the button isn't disabled. The real requirement is presumably unchecked, required boxes. Should it re-prompt when the Terms or Privacy version changes?
16. **Onboarding.** The exam pills can't be clicked. Can a user set several exams during onboarding? Is adding an exam free (countdown only) or tied to a purchase, given "+ Add an exam" goes to Plans?
17. **Session security.** Does "Sign in on this device" require re-auth, and does it kick the other device back? Should there be an abuse or limit policy for repeated device switching?
18. **Lesson completion.** It is manual ("Mark complete") and lessons aren't sequentially locked. Should completion trigger automatically at a watch threshold?
19. **Unreachable in-app states.** Loading, emptyTopic, expired, endingSoon and session can only be triggered from the design tool. The planner should decide the real triggers, e.g. whether emptyTopic replaces the topic row or only appears on tap.
20. **Missing features to confirm as out of scope:** offline use (explicitly not supported for reviewers), mobile bottom tabs (computed but unused v1 code), notifications settings, profile editing, and spaced repetition beyond the got/again marking.
