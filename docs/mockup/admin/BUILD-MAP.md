> Build map of the **admin** mockup, generated on 2026-10-29 by reading the source in full. Line numbers refer to the files in `docs/mockup/admin/`. It is a reference, not a spec: the "Ambiguities" listed here were resolved during planning, and `docs/specs/` and `docs/adr/` win wherever they disagree with this map.

# AYC Admin mockup (`AdminDashboard_v2.dc.html`): map for the build

I read the main file from start to finish (template lines 1–951, logic class 952–1673) and also read `ReviewCard.dc.html`. The other JS files hold only runtime code: a resource/`__ayc` loader shim, motion presets and the dc-runtime. None of them contain app logic. All data is in-memory sample data, and the header always shows a red dashed **"SAMPLE DATA"** tag (line 75). The script calls the data module `ayc-data.js` (line 961). It uses `D.bySold()`, `D.byId()`, `D.EXAMS`, `D.EXAM_INFO`, `D.PRODUCTS` and `D.peso`.

---

## 1. Purpose and audience

- **Who uses it:** AYC staff only. Sign-in is Google-only through an allowlist: "Only Google accounts on the admin list can open the dashboard." (889, 697)
- **Signed-in user shown:** "Angel Rose L. Lepaña", angel@aceyourcourse.ph, badge **OWNER** (33–35). The Overview greets "Good morning, Angel." (706)
- **Roles** (Add-admin modal, 1642–1643):
  - **Owner:** "Everything, including orders, plans and prices, users, and admin accounts."
  - **Editor:** "Pages, products, reviews, FAQs, content, and courses. Can't see orders, change prices, or manage admins."
  - **Invited:** a pending state. Invites "expire after 7 days" (936).
- **Not enforced:** the mockup never hides navigation by role. Every section is visible to everyone.
- **What the admin covers:** website content (exam pages, promo banner, products, reviews, FAQs), digital content for the member app (reviewer PDFs, flashcards, quizzes, video courses), and digital sales (plans, PayMongo orders, users).
- **What it does not cover:** physical/marketplace sales. Those stay on Shopee, Lazada and TikTok Shop. The admin only manages outbound links and figures copied by hand.

---

## 2. Sections and navigation

**Desktop:** a 268px left sidebar (14–38). It holds:
- the logo with an "ADMIN" tag;
- a clickable **"PAID TODAY · 22 OCT · ₱6,240 · 9 orders · 4 pending"** card that opens Orders (17–21);
- the grouped nav;
- the user block with **Sign out**, which goes to the sign-in screen.

**Mobile** (`mobile` prop): a floating **"Menu"** button (908) opens a slide-in drawer with the same content. Escape or tapping the scrim closes it (40–69, 960).

**Header** (72–79) shows the group label, the page title, "SAMPLE DATA", **"View site ↗"** (links to `Home.dc.html`) and a per-section primary button.

**Sidebar nav** (1550–1557). Badges are hardcoded:

| # | Group | Item (screen key) | Header primary action | Badge |
|---|---|---|---|---|
| 01 | HOME | Overview (`overview`) | — | |
| 02 | WEBSITE | Exam pages & promo (`cms`) | — | |
| 03 | WEBSITE | Products & store links (`products`) | "+ Add product" (opens a new product form) | 14 |
| 04 | WEBSITE | Reviews & FAQs (`reviews`) | "+ Add" (new review or new FAQ, depending on tab) | |
| 05 | CONTENT | Reviewer uploads (`uploads`) | "+ Upload PDF" (starts a split job) | 1 (red) |
| 06 | CONTENT | Flashcards & quizzes (`editor`) | — | |
| 07 | CONTENT | Courses & videos (`courses`) | "+ New course" | |
| 08 | SALES | Plans & prices (`plans`) | "+ New plan" | |
| 09 | SALES | Orders & payments (`orders`) | "Export CSV" | 4 (orange) |
| 10 | SALES | Users (`users`) | — | |
| 11 | SETTINGS | Support, stores & admins (`settings`) | — | |

**Screens not in the sidebar** (952, 1561–1562):
- `orderDetail`: reached by clicking an order row.
- `userDetail`: reached from a user row, from the order's member link, or from "Plans ending" rows.
- `reviewEdit` and `faqEdit`: older full-page editors with static values. They are reachable only from the empty-reviews CTA or by setting a prop.
- `loading`: a skeleton labelled "LOADING ORDERS…".
- `emptyOrders` and `emptyReviews`: empty states.
- `signin` and `denied` (403).

**Tabs:**
- Reviews & FAQs: **REVIEWS / FAQS** (233, 1141).
- Flashcards & quizzes: **FLASHCARDS / QUIZZES** (398, 1302).

**Modals** (912–941, MD at 1565–1576). Three of them require typing **"TYPE DELETE TO CONFIRM"**: deleteProduct, deleteLesson and deleteReviewer.

| Key | Trigger | Copy (abridged) |
|---|---|---|
| deleteProduct | Product editor → Delete | "It disappears from the website, the Products page, and the CE exam page. Store listings on Shopee, Lazada, and TikTok Shop are not affected." |
| deleteReview | Review editor → Delete | "Removed from Home, its product page, and its exam page. The original stays on the store." |
| deleteFaq | FAQ editor → Delete | "…removed from the FAQ page and from what search engines and AI assistants can quote. To keep it for later, turn off 'Show on FAQ page' instead." |
| deleteReviewer | Uploads → Delete | "…pages are removed from the member Library… members lose their place… The original PDF is deleted from storage." |
| deleteCard | Card editor → Delete | "Members who marked it lose that mark." |
| deleteQuestion | Question editor → Delete | "Past scores stay as they were." |
| deleteLesson | Lesson → Delete lesson | "…214 members lose their saved position in this lesson." |
| signOut | Users row "Sign out device" or User detail | "Sign Paolo out of Chrome on Windows? … Their plan and progress stay the same." This is the only confirm wired to change state (1530). |
| removeAdmin | Settings → Remove | "content@aceyourcourse.ph loses access … right away and is signed out. Their edits stay. If they also have a member account, that isn't affected." |
| cancelInvite | Settings → Cancel invite | "The link in their email stops working." |
| addAdmin | "+ Authorise an account" | A separate modal (926–941) with GOOGLE ACCOUNT EMAIL, ROLE radio (Editor/Owner) and **Send invite**. |
| unpublish | **No trigger in the UI** (prop only) | "Turn off the 11.11 sale banner now? It disappears from Home right away instead of on 11 Nov." |
| saveFailed (toast) | Prop only | "COULDN'T SAVE · 'CE Formula Flash Cards' wasn't saved. Check your connection. Your edits are still in the form." Buttons: Try again / Dismiss (943–949). |

---

## 3. Contents and interactions, section by section

### 3.1 Overview (704–750; data 1578–1666)
- **Greeting:** "THURSDAY · 22 OCT 2026", "Good morning, Angel.", "5 things need you today. October sales are up 18% on September."
- **Quick actions:** + Upload reviewer, + Add product, + New plan, + Add FAQ. These only navigate to the section; they don't open a new form.
- **KPI tiles** (1663), each clickable:
  - PAID TODAY ₱6,240 "+₱1,120 VS YESTERDAY" → Orders
  - PAID · OCTOBER ₱184,620 "+18% VS SEPTEMBER" → Orders
  - ACTIVE MEMBERS 496 "+38 THIS MONTH" → Users
  - PLANS ENDING · 7 DAYS 23 "RENEW PROMPT SHOWN" → Users
- **"Paid sales" bar chart** (1654–1662):
  - toggle between 14 and 30 days; daily totals with tooltips;
  - the hover readout shows day and amount; today's bar is orange;
  - subtitle "PAID · LAST 14 DAYS · +18% VS PREVIOUS 14".
- **"Needs attention" (5)** (1578–1583):
  - "4 payments pending: Oldest is 18 hours old. Pending payments expire after 24 hours." → Review
  - "14 product links use the shop page" → Add links
  - "1 reviewer upload failed: HPGE Reviewer – Soil Mechanics.pdf is password-protected." → Fix
  - "23 plans end this week: Members will see a renew prompt. Nothing renews automatically." → View users
  - "Promo banner is hidden: Turn it on in Exam pages & promo when the next sale starts." → Open
- **"Recent orders":** 5 rows plus "All orders →". Every row opens the default order, AYC-10479.
- **"Active members · 496 TOTAL"** by exam: CE 310, MT 96, ME 41, CPA 33, EE 16 (1585).
- **"Plans ending in 7 days" ("All 23 →"):** Rica Mendoza CE 24 OCT, Leo Garcia MT 25 OCT, Ana Cruz CE 26 OCT, Ben Ramos CPA 28 OCT.
- **"Top-selling content · October" (BY ACTIVE MEMBERS & SALES)** (1666):
  1. PLAN: CE All-Access · 3 months, "214 active · ₱1,299"
  2. COURSE: PSAD Masterclass, "62 sold this month"
  3. FLASHCARDS: MSTC · Simple Curves, "1,820 cards marked"
  4. REVIEWER: HPGE – Hydrostatics, "412 opens this week"

### 3.2 Exam pages & promo (CMS) (82–147; 964–1061)
The page uses three columns.

**Column 1, PAGES.** Only two pages are listed (`order = ['exam','home']`, 1022): **"Exam pages × 5"** and **"Home promo banner"**. A fixed note reads: "Home, About, Products, menu, footer, and legal pages are fixed. Changes to those go through the developer." (87)

**Column 2, the selected page:**
- exam chips CE/ME/EE/MT/CPA (exam pages only) and "View page ↗";
- a **"Search & AI visibility"** card with state GOOD, CHECK or N/A;
- **SECTIONS · SHOW OR HIDE**, each with a toggle or an "ALWAYS ON" label. The code encodes this as `on`: 2 = fixed, 1 = shown by default, 0 = hidden by default.

**Exam page sections** (981–989):
- **Header** (always on): EXAM NAME, TEXT (from `EXAM_INFO.blurb`), HEADER IMAGE "From the top-selling CE product".
- **Subjects covered**: HEADING, SUBJECTS list ("MSTC · Mathematics, Surveying…").
- **Reviewers** (always on): note "Products are listed automatically, best selling first."
- **Bundle offer** (CE only): "Review, solve, and memorize. One order.", "Cards, notebook, and posters for MSTC, HPGE, and PSAD for ₱3,499.", BUTTON "See the bundle".
- **In the app** (other exams): "Review ME on your phone, one card at a time.", BUTTON "See ME plans".
- **Reviews**: "From CE reviewees", note "Shows reviews attached to CE products."

**Home promo banner** (969–973). Default hidden, "Strip at the top of Home · off until the next sale". Fields:
- BANNER TEXT "11.11 SALE · Any 2 reviewers, 4% off on Shopee"
- BUTTON LABEL "Shop the sale"
- LINK "shopee.ph/aceyourcourse"
- STARTS ON "9 Nov 2026", ENDS ON "11 Nov 2026"
- note "The banner turns off by itself after the end date. Everything else on Home is fixed."

**Column 3, the editor.** Field types are text, textarea, image ("Replace"), numbered list, and info note with a deep link.

**SEO panel** (110–124, 1045–1048):
- PAGE ADDRESS (read-only, e.g. `aceyourcourse.ph/exams/ce`)
- PAGE TITLE with an n/60 counter
- META DESCRIPTION with an n/160 counter; GOOD requires a title ≤60 and a description of 80–160 characters
- a Google-style SEARCH PREVIEW
- SHARE IMAGE · 1200 × 630
- "SET UP AUTOMATICALLY": Product data ON, Breadcrumbs ON, Summary for AI assistants ON (exam pages)

**Save behaviour:** Save goes live immediately: "✓ SAVED · LIVE ON THE SITE", otherwise "UNSAVED CHANGES" or "CHANGES GO LIVE WHEN YOU SAVE". There is no draft or scheduling, apart from the banner dates.

**Unreachable page definitions.** The code fully defines editable sections for Products, About Us, FAQs, Privacy Policy, Terms of Use, and Menu & footer (974–1020). None of them are reachable in v2. Their example copy includes:
- About: "Made by board passers, for the next batch."; TEAM PHOTO "needed from client"; Founder story "Needed from client."
- Legal: Privacy cites "Data Privacy Act of 2012 (RA 10173)". Terms key points are "Plans are for one person · One active device at a time · Plans don't renew automatically · Sharing or copying content ends access".
- Menu links: Exams/Products/Reviews/About/FAQ; main button "Start reviewing".
- Footer: "© 2026 AceYourCourse · IPOPHIL registered"; "Store and social links come from Settings."

### 3.3 Products & store links (149–229; 1064–1130)

**List:**
- Filters: search, exam chips ALL/CE/ME/EE/MT/CPA, and a **"Missing product links"** toggle (matches products lacking a Lazada or TikTok link).
- Rows are sorted by units sold.
- Columns:
  - **PRODUCT · count**: thumbnail, short name, "FLASH CARDS · 764 SOLD"
  - **EXAM**
  - **PRICE**: "₱400+" when there is a price range
  - **STORE LINKS**: S/L/T badges, green = product link, amber = shop page, plus "n/3"
  - **APP · SITE**: inline toggles
- Rows hidden from the site are dimmed.
- Legend: "GREEN = PRODUCT LINK · AMBER = OPENS THE SHOP PAGE" (171).
- There are no bulk actions or column sorting.

**Editor panel:**
- PHOTOS · FIRST IS THE COVER: shows 4 photos and a "+" tile. Caption "8 photos · drag to reorder"; for a new product, "Add photos. Square images work best, at least 1000 × 1000."
- FULL NAME; SHORT NAME · FOR CARDS; EDITION.
- EXAM select: CE · CELE, ME · MELE, EE · REE, MT · MTLE, CPA · CPALE.
- FORMAT select: Flash cards / Notebook / Posters / Bundle.
- SIZE & PAPER.
- SUBJECTS COVERED: multi-select chips taken from `EXAM_INFO` subject codes.
- **PRICE & VARIATIONS:** PRICE FROM; PRICE UP TO · OPTIONAL; VARIATIONS rows of name + price with ×; "+ Add variation". The admin strips the "CE POSTERS 2.0:" prefix from variation names (1095).
- RATING, NO. OF RATINGS, UNITS SOLD, with the note **"Copy these from the Shopee listing. Best sellers on Home are ranked by units sold."** (201)
- PRODUCT PAGE TEXT: WHAT'S INSIDE (default template "Flash cards for the CELE, covering MSTC, HPGE, PSAD. For the board exam, school, and professional review.") and MADE FOR · ONE PER LINE (default from exam name and `for3`).
- STORE LINKS: SHOPEE, LAZADA, TIKTOK SHOP. Each is labelled "· PRODUCT LINK" or "· USING SHOP PAGE" and shows a dashed amber border when empty. Note: "Leave a link empty and the button opens that store's shop page (set in Settings)."
- SEARCH & AI VISIBILITY: PAGE TITLE (60) and META DESCRIPTION (160), auto-generated. "Product data, price, and rating for search engines are added automatically."
- VISIBILITY:
  - **Available in app**: "Shows the IN APP tag and 'See plans' on the site". The default comes from `aycData.DIGITAL`.
  - **Show on website**: "Off hides it from Products, exam pages, and Home".
- Buttons: Save product / Add product, and Delete. Validation: "ADD A NAME AND PRICE TO SAVE" (the code only checks the name, 1107). Status values: UP TO DATE, UNSAVED CHANGES, NOT SAVED YET, "✓ SAVED · LIVE ON THE SITE". "View page ↗" links to `Product.dc.html?id=…`.

### 3.4 Reviews & FAQs (231–314; 1132–1211)

**REVIEWS tab**
- **List filters:** "Search review text", exam chips, star chips (ANY ★ / 5★ / 4★ / 3★), and a "Pinned on Home only" toggle.
- **Counters:** "N REVIEWS" and "N OF 9 PINNED ON HOME" (red, with "· HOME SHOWS THE FIRST 9", when more than 9 are pinned).
- **Rows:** stars, a 2-line excerpt, meta "CE · ULTIMATE CE POSTERS 2.0 · MSTC, HPGE, PSAD · SHOPEE · 19 HELPFUL", and a HOME pin toggle.
- **Footer:** "EVERY REVIEW SHOWS ON ITS PRODUCT PAGE AND EXAM PAGE · PINNED ONES ALSO SHOW ON HOME".
- **Editor:**
  - STARS: 1–5, clickable
  - REVIEW TEXT · COPY WORD FOR WORD (placeholder "Paste the review exactly as written on the store")
  - PRODUCT select ("CE · CE Formula Flash Cards")
  - VARIATION BOUGHT · OPTIONAL
  - STORE: Shopee / Lazada / TikTok Shop
  - HELPFUL VOTES
  - Pin on Home
  - PREVIEW: a `ReviewCard`, shown once text exists
  - Add/Save review and Delete
  - Validation: "PASTE THE REVIEW TEXT TO SAVE"
- **ReviewCard** (separate file) shows stars, an exam badge, the text, the product title, "Variation: … / not specified" and "N found this helpful". It has **no reviewer name, no date and no store label**.

**FAQS tab**
- **Left column, GROUPS** with counts, and the note "Groups match the sections on the FAQ page." Groups are fixed. There is no UI to add, rename or reorder them.
- **Centre column:**
  - "Search questions in all groups"
  - label "SHIPPING · 3 QUESTIONS · ▲▼ TO REORDER"
  - rows with ▲▼ (disabled while searching) and meta "WITH REVIEW QUOTE / ANSWER ONLY / · HIDDEN"
  - "+ Add question to {group}"
  - info: "Published with FAQ structured data, so search engines and AI assistants can quote the answers. Keep answers short and direct."
- **Editor:**
  - QUESTION (placeholder "Write it the way a reviewee would ask")
  - ANSWER with an "n / 400 CHARACTERS" counter that turns red when over
  - GROUP select
  - **SUPPORTING REVIEW · OPTIONAL**: QUOTE FROM A REAL REVIEW and CREDIT LINE ("★★★★★ · Product name")
  - **Show on FAQ page** ("Off keeps it saved but hidden")
  - Add/Save question and Delete
  - Validation: "WRITE A QUESTION AND ANSWER TO SAVE" (checks the question only). On save: "✓ SAVED · LIVE ON THE FAQ PAGE".

### 3.5 Reviewer uploads (316–394; 1216–1273)

**Drop zone:** "Drop a reviewer PDF here · Uploaded as-is. Each page becomes its own image. The PDF itself is never shown to members. Up to 200 MB." plus a "Choose file" button.

**Job card while processing:**
- "new-reviewer.pdf · 14.2 MB · SPLITTING 24 / 36"
- a progress bar and a page-thumbnail grid
- "You can leave this page. It keeps going and shows up as a draft when done."
- When finished, a new DRAFT appears: "Untitled reviewer", CE › MSTC, no topic, CE All-Access.

**List:**
- filters: search, exam chips (plus any added "courses"), status chips (ANY STATUS / PUBLISHED / DRAFT / UNPUBLISHED / FAILED)
- columns: REVIEWER · n (title plus "CE › MSTC › Simple Curves"), PAGES, PLAN, STATUS

**Detail panel:**
- **FAILED** box: "Couldn't split this PDF: The file is password-protected… Remove the password in your PDF app, save a copy, and upload it again." plus "Upload a new file".
- **Page preview:** "PREVIEW · 1 / 36 · AS MEMBERS SEE IT", with a member@email.com watermark and ←/→ paging.
- **DETAILS:** TITLE MEMBERS SEE; FILE with Replace.
- **PLACEMENT:**
  - EXAM and SUBJECT selects
  - **"+ Add course"**: "Adds the course to every content screen and the member app's exam list. It stays hidden from members until it has published content." (placeholder "e.g. ChE, Nursing, Architecture")
  - **"+ Add subject to CE"**: "Adds the subject under CE in uploads, flashcards, quizzes, and courses."
  - TOPIC: free text with datalist suggestions
  - **INCLUDED IN**: "{EXAM} All-Access", "PSAD Masterclass", "Free preview"
  - "Shows in the member Library under CE › MSTC › Simple Curves."
- **PROTECTION · ALWAYS ON:** "Member's email as a watermark on every page", "No download, print, or text selection", "One page loaded at a time" (1265).
- **Buttons:** Publish / Unpublish, Save, Delete. Publishing requires a topic: "CHOOSE A TOPIC BEFORE PUBLISHING".

### 3.6 Flashcards & quizzes (396–484; 1275–1346)

**Layout:** tabs, then exam chips, then subject chips (from `EXAM_INFO`). The left column lists "CE · MSTC · TOPICS". Each topic shows a count (or "N Q") and a status of EMPTY, VISIBLE or HIDDEN. There is an "+ Add topic" button, which is not wired.

**Deck header:** "Simple Curves flashcards", "6 CARDS · CE ALL-ACCESS", and a **"Visible to members"** toggle. The toggle is blocked when the deck is empty: "ADD AT LEAST ONE CARD BEFORE MAKING IT VISIBLE". Visibility is stored **separately for the cards and quiz tabs** of each topic.

**Quiz settings** (per topic): PASSING SCORE (default "70%"), SHUFFLE QUESTIONS, SHOW ANSWERS AFTER.

**Item list:** search, "+ Add card / + Add question", rows with ▲▼ reorder, number, and front/back text (or "ANSWER B · 53.59 m"). Footers:
- "MEMBERS SEE ONE CARD AT A TIME WITH THEIR EMAIL AS A WATERMARK"
- "MEMBERS ANSWER ONE QUESTION AT A TIME · SCORE SHOWN AT THE END"

**Card editor:**
- FRONT · THE PROMPT ("e.g. Tangent distance")
- BACK · THE ANSWER OR FORMULA (monospace, "e.g. T = R tan(I/2)")
- IMAGE ON THE BACK · OPTIONAL ("PNG or JPG")
- NOTE · OPTIONAL ("Units, conditions, or a memory tip")
- **PREVIEW · TAP TO FLIP**, with a watermark
- Save / Add card, **Save & add next**, Delete
- Validation: "ADD A FRONT AND A BACK TO SAVE"

**Question editor:**
- QUESTION ("Write the problem as it would appear on the board exam")
- "Figure · optional / Add image" (not wired)
- 4 choices A–D, with "TAP THE CIRCLE TO MARK THE CORRECT ONE"
- EXPLANATION · SHOWN AFTER SCORING
- deck meta "QUESTIONS · 1 POINT EACH"
- Validation: "FILL IN THE QUESTION AND ALL 4 CHOICES, AND MARK THE CORRECT ONE"
- Save states: "✓ SAVED · LIVE FOR MEMBERS" and "✓ SAVED · WRITING THE NEXT ONE"

### 3.7 Courses & videos (486–587; 1348–1417)

**Left column:** "COURSES · 3" list (title, "CE · 9 LESSONS", VISIBLE/HIDDEN) and "+ New course".

**Centre column:**
- course header card: cover, title, meta "CE · PSAD · 3 MODULES · 9 LESSONS · 7 PUBLISHED", and "Course settings →"
- modules M1…: inline-editable uppercase title, ▲▼ reorder, "N LESSONS"
- lessons "2.4": ▲▼, title, a "FREE PREVIEW" tag, and a status or duration
- "+ Lesson" and "+ Module"
- empty state: "Group lessons into modules, like 'Reinforced concrete' or 'Steel design'."
- footer: **"MEMBERS RESUME WHERE THEY STOPPED · PROGRESS COUNTS A LESSON AS DONE AT 90% WATCHED"** (520)

**Course settings:**
- COURSE TITLE, DESCRIPTION, Cover image · 16:9, EXAM select, SUBJECT (free text)
- **HOW MEMBERS GET IT**: "Included in CE All-Access" ("Members with an active plan can watch every lesson") or "Sold separately" ("A one-time purchase with no expiry, like the PSAD Masterclass"), which reveals ONE-TIME PRICE
- **Course visible to members**, with "214 members have access" or "Needs at least one published lesson". It is blocked without a published lesson.

**Lesson editor:**
- LESSON TITLE
- video states:
  - ready: player, duration, watermark, "Replace video"
  - uploading: "UPLOADING TO SECURE VIDEO SERVICE", "41% · ABOUT 6 MIN LEFT · YOU CAN LEAVE THIS PAGE"
  - failed: "UPLOAD FAILED AT 63% … Your draft is saved. Retry continues from where it stopped." with Retry upload / Choose another file
  - none: "Drop a video… MP4 or MOV, up to 4 GB. Uploads go straight to the protected video service."
- facts: PROTECTION "DRM · Widevine + FairPlay", WATERMARK "Member email", DOWNLOADS "Off", STORAGE USED "38 of 100 GB"
- LESSON NOTES · SHOWN UNDER THE VIDEO
- **Free preview** ("Anyone signed in can watch this one lesson")
- Publish lesson / Unpublish, Save, Delete lesson
- Validation messages: "WAIT FOR THE VIDEO TO FINISH UPLOADING", "ADD A TITLE BEFORE PUBLISHING", "ADD A VIDEO BEFORE PUBLISHING"

### 3.8 Plans & prices (589–647; 1424–1461)
- **Exam filter chips.**
- **"SUBSCRIPTION PLANS · n" table:** name (with a "BEST VALUE" tag) and what it includes, PERIOD, PRICE, ACTIVE (user count), and an ON toggle.
- **"ONE-TIME PURCHASES · NO EXPIRY" table.**
- **Footer:** "PAID THROUGH PAYMONGO · MEMBERS RENEW THEMSELVES · NOTHING RENEWS AUTOMATICALLY".
- **Editor:**
  - PLAN NAME, EXAM
  - ACCESS PERIOD: "1 month · 30 days / 3 months · 90 days / 6 months · 180 days / 12 months · 365 days"
  - PRICE
  - **UNLOCKS · TAP TO INCLUDE**: Flashcards, Practice quizzes, Reviewer PDFs, Video courses "(CE courses marked 'included')"
  - Mark as best value
  - **On sale** ("Off hides it from Plans. Current buyers keep access.")
  - **PREVIEW · MEMBER PLANS PAGE**: tag "CE · 3 MONTHS", price, computed "₱433 / month" or "for 30 days", check list, "DOESN'T RENEW AUTOMATICALLY · PAID THROUGH PAYMONGO"
  - "Price changes apply to new purchases only. Members who already paid keep what they bought."
  - Validation: "ADD A NAME, A PRICE, AND AT LEAST ONE UNLOCK"
- **One-time items** only edit name, price and On sale: "Lessons and videos are managed in Courses & videos." There is no delete for plans.

### 3.9 Orders & payments (659–676; detail 752–785; logic 1481–1510)

**Stat tiles:** PAID · OCTOBER ₱184,620; ORDERS 163; PENDING 4; FAILED 7.

**Filters:**
- "Search by order number or email"
- status chips: ANY STATUS / PAID / PENDING / FAILED
- method: All methods / QR Ph / GCash / Maya / Card
- range: Last 7 days / Last 30 days (default) / All time

**Export CSV** shows "✓ CSV EXPORTED · MATCHING ORDERS ONLY", so the export respects the filters.

**Columns:** ORDER, DATE, MEMBER (email), ITEM, METHOD, AMOUNT, STATUS. Footer: "Payment status comes from PayMongo. Card details are never stored on the platform."

**Order detail:**
- MEMBER (links to the user), ITEM, AMOUNT, METHOD, **PAYMONGO REF** (`pi_10479XkQ2mV4rT9pLw`), CREATED
- **TIMELINE** by status:
  - PAID: "Checkout started → Paid with X → PayMongo confirmed · access granted"
  - PENDING: "…Sent to Maya → Waiting for Maya to confirm"
  - FAILED: "…Card declined by the bank"
- **STATUS NOTE**, for example: "Access is granted automatically when PayMongo confirms. Pending payments expire after 24 hours." / "They saw the 'Payment didn't go through' screen with other ways to pay."
- **INTERNAL NOTE**: "✓ NOTE SAVED · ONLY ADMINS SEE IT"
- **ACTIONS**: "Check status with PayMongo" (result "CHECKED JUST NOW · STILL PENDING AT MAYA") and "Open in PayMongo dashboard ↗". "Refunds are issued from the PayMongo dashboard."

### 3.10 Users (649–657; detail 787–825; logic 1463–1530)

**List:**
- "Search by name or email"
- pill filters: All / Active plan / Expired / No plan / Admins
- columns: USER (name and email), EXAM, ACCESS, EXPIRES (red if EXPIRED), ACTIVE SESSION ("Chrome · Android · now"), ROLE, and a "Sign out device" action
- footer "8 OF 612 USERS SHOWN · SAMPLE DATA"

**Detail:**
- initials avatar, name, "email · Google"
- EXAM ("ME · MELE"), **EXAM DATE** ("Sun · 8 Feb 2027"), JOINED, ROLE
- ACTIVE SESSION with "Sign out this device"
- **PLANS**: name, "until 9 Nov 2026 (+7 days)", and status ACTIVE / ENDED / PENDING
- **"Extend access…"**: "ADD DAYS TO {plan}" with 3, 7, 14 or 30 days
- **"Grant a plan…"**: any plan or one-time item
- both panels: "REASON · SAVED IN THE HISTORY" (placeholder "Payment confirmed late by Maya") and "No payment is collected. The member gets an email." Results: "✓ ADDED 7 DAYS · PAOLO WAS EMAILED" and "✓ GRANTED … · NO PAYMENT COLLECTED"
- **PROGRESS**: FLASHCARDS MARKED, QUIZ AVERAGE, LAST ACTIVE
- **PURCHASE HISTORY**: id, date, item, amount, status

### 3.11 Settings (678–702; 1531–1542)

**SUPPORT EMAIL:** "The Email Support button in the member app opens an email to this address."
- default support@aceyourcourse.ph; validation "ENTER A VALID EMAIL ADDRESS"
- DEFAULT SUBJECT LINE "AceYourCourse support"
- "Send test email" and Save
- "LAST CHANGED 14 OCT 2026 BY ANGEL ROSE L. LEPAÑA"

**STORE & SOCIAL LINKS:** "Used for every store button unless a product has its own link."
- SHOPEE, LAZADA, TIKTOK SHOP, TIKTOK PROFILE, each with domain checks: "SHOULD BE A SHOPEE.PH LINK", "…LAZADA.COM.PH…", "…TIKTOK LINK", "SHOULD LOOK LIKE TIKTOK.COM/@NAME"
- helper: "EMPTY LAZADA OR TIKTOK HIDES THAT BUTTON"
- on save: "✓ SAVED · EVERY STORE BUTTON UPDATED"

**ADMIN ACCOUNTS:**
- Angel: OWNER, "YOU · CAN'T BE REMOVED"
- AYC Content Team, content@aceyourcourse.ph: EDITOR, "LAST SIGNED IN 2 DAYS AGO", Remove
- "Invite sent", kim.reyes@gmail.com: INVITED, "EXPIRES IN 6 DAYS · RESEND", Cancel invite
- "+ Authorise an account". The invite copy: "They get an email with a link. Access starts the first time they sign in with this Google account. Invites expire after 7 days."

### 3.12 Auth screens (883–906)
- **Sign-in:** "Sign in to manage the site" with "Continue with Google".
- **Denied:** "403 · NOT AUTHORISED · You're signed in as juan.delacruz@gmail.com, which isn't on the admin list. Nothing was changed." Buttons: "Use another account" and "Go to the member app". Footer: "THIS ATTEMPT WAS LOGGED · 22 OCT 2026, 11:42 AM".

---

## 4. Entities and fields

**From aycData.js:**
- **Product**:
  - `id` (Shopee item id, e.g. 24292303887), `exam`, `board`, `short`, `title`
  - `format` (Flash cards / Notebook / Posters / Bundle), `size` ("4 × 6 in · 160 gsm"), `edition`
  - `url` (Shopee), `price`, `priceMax`, `rating`, `ratingCount`, `sold`, `subjects[]`
  - `deal`, `images[]`, `variations[{name, price, inStock}]`, `reviews[]`, `pending`, `digital`
  - The admin **adds**: `lazadaUrl`, `tiktokUrl`, `showOnSite`, `inApp`, `whatsInside`, `madeFor[]`, `seoTitle`, `seoDesc`.
  - The admin **does not expose**: `deal`, `inStock`, `pending`, `board`.
- **Review**: `stars`, `text`, `variation`, `helpful`, plus the derived `product` and `exam`. The admin **adds** `source` (Shopee/Lazada/TikTok Shop) and `pinnedOnHome`.
- **Exam**: `code`, `board`, `name`, `soon`; plus EXAM_INFO `long`, `blurb`, `for3`, `subjects[[code, name]]`.
- **Also used:** STORES and SHOP.

**Hardcoded in the admin:**

| Entity | Fields (example) | Lines |
|---|---|---|
| Reviewer (PDF) | id, title "MSTC Reviewer – Simple Curves", exam, subj, topic, pages 36, plan "CE All-Access", st DRAFT, file "mstc-simple-curves.pdf" (11 rows) | 954 |
| Topic / Deck | per `EXAM|SUBJECT`: [name, cards[[front, back, note?]], questions[[text, [4 opts], correctIdx, explanation]], pub]. Only CE|MSTC (Algebra, Trigonometry, Calculus, Surveying, Simple Curves, Spiral Curves) and CE|HPGE (Hydrostatics, Soil Mechanics) have data | 955 |
| Quiz settings (per topic) | pass "70%", shuffle, reveal | 1342 |
| Course | id "psad", title, exam, subj, access "one"/"plan", price "₱1,499", enrolled 214, pub, desc, modules[{t, lessons[{t, dur "18:22", st pub/draft/uploading/none, free, notes}]}] (3 courses) | 956 |
| FAQ group / item | group title; item q, a, quote, quoteBy (5 groups) | 957 |
| CMS page / section / field | page {t, url, view, og, seo[title, desc], flags[[label, ON/AUTO]], sec[[id, title, desc, on 0/1/2, fields]]} | 968–1020 |
| Promo banner | text, button label, link, start, end, visible | 973 |
| Plan (subscription) | id, exam, name "CE All-Access", months 1/3/6/12, price, users, on, best, unl [types] (7 plans) | 1426–1433 |
| One-time product | id "psad", name, kind "Video course · CE", price ₱1,499, users 214, on | 1434 |
| User / member | e (email), n, exam, plan, exp, sess, role MEMBER/OWNER, st, date (exam date), joined, prog [cards marked, quiz avg, last active] (8 users) | 1463–1471 |
| Order | id "AYC-10482", date, email, item, method QR Ph/GCash/Maya/Card, amt, status, PayMongo ref, internal memo (8 orders) | 1482–1506 |
| Entitlement / grant | plan name, until date, +days extension, granted-by-admin, reason | 1512–1527 |
| Device session | browser · OS · last seen; signed-out flag | 1464, 1530 |
| Admin account | name, email, role OWNER/EDITOR/INVITED, last-signed-in / invite-expiry | 1637–1641 |
| Settings | support email, subject, shopee, lazada, tiktok, tiktok profile, last-changed by | 1532 |
| Video asset | file "psad-m2-l4.mp4 · 1.2 GB", duration, DRM, upload progress, storage quota | 1402–1408 |
| Dashboard metrics | daily paid sales (30 values), KPIs, by-exam actives, alerts, top content | 1578–1666 |

**Not present anywhere:**
- access or redemption codes
- marketplace order records
- inventory or stock
- discount/promo codes (only a banner)
- SKUs
- a reviewer author name or date
- an audit-log screen

---

## 5. Statuses and lifecycles

- **Order:** PENDING → PAID when PayMongo confirms (access is granted automatically); a declined payment is FAILED. Pending payments "expire after 24 hours", but no EXPIRED status is shown. There is no REFUNDED status; refunds happen outside the admin (1492, 1503–1504).
- **Member plan line:** ACTIVE, ENDED, PENDING ("pending payment"). Expiry is a date, or "NO EXPIRY" for one-time items. Extend or grant changes it to ACTIVE.
- **User filter status:** ACTIVE, EXPIRED, NO PLAN, ADMIN. Role: MEMBER or OWNER.
- **Reviewer PDF:** PROCESSING ("SPLITTING n/36") → DRAFT, or → FAILED (password-protected, re-upload). DRAFT → PUBLISHED requires a topic. PUBLISHED ↔ UNPUBLISHED (1218, 1267).
- **Lesson:** NO VIDEO → UPLOADING → DRAFT, or → UPLOAD FAILED → retry resumes. DRAFT → PUBLISHED requires a title and a ready video. Unpublish returns it to DRAFT (1361, 1411).
- **Course:** HIDDEN ↔ VISIBLE. VISIBLE needs at least one published lesson.
- **Topic deck (per tab):** EMPTY / HIDDEN / VISIBLE. VISIBLE needs at least one item.
- **Plan:** on sale or off; best value on or off.
- **Product:** show on website on/off; available in app on/off. There is no draft state; save goes live.
- **Review:** pinned or not. There is no approve/reject state.
- **FAQ:** shown or hidden.
- **CMS section:** shown, hidden, or "ALWAYS ON". SEO state GOOD / CHECK / N/A.
- **Promo banner:** hidden → on (manual) → auto-off after the end date. "Turn off banner" is an early-off.
- **Admin account:** INVITED (7-day expiry, resend, cancel) → active on first Google sign-in (EDITOR or OWNER) → removed. Removal signs them out.
- **Save states (everywhere):** UP TO DATE / UNSAVED CHANGES / NOT SAVED YET / ✓ SAVED · LIVE… / validation error (red).

---

## 6. Business rules

**Digital access** is granted only through:
1. a PayMongo-confirmed purchase of a plan or one-time item;
2. an admin "Extend access" (3–30 days) or "Grant a plan", with no payment, a reason "saved in the history" and an email to the member;
3. "Free preview" content (a lesson free to "anyone signed in"; a reviewer can be "Included in: Free preview").

Buying a physical product does not grant app access. The product's "Available in app" toggle is only a website badge plus a "See plans" link.

**Subscriptions:**
- fixed periods of 30, 90, 180 or 365 days; no auto-renew; members renew themselves from the "Billing page"; a renew prompt appears near the end
- one-time purchases never expire
- price changes apply only to new purchases
- turning a plan off hides it from sale, but "current buyers keep access"

**Plan content model:**
- a plan is scoped to one exam and unlocks content *types* (Flashcards, Practice quizzes, Reviewer PDFs, Video courses)
- video courses are covered only when the course is marked "Included in {exam} All-Access"
- "Sold separately" courses are separate one-time products

**Content protection** (always on):
- the member's email as a watermark on PDF pages, cards and video
- no download, print or text selection
- PDF pages load one at a time; the original PDF is never served
- video uses DRM (Widevine + FairPlay) with downloads off

**Single session:** one active device per member. The FAQ says: "Signing in on a new device signs out the old one." Admins can force a sign-out.

**Progress:**
- a lesson counts as done at 90% watched; members resume where they stopped
- flashcards can be "marked"
- quizzes score 1 point each, with a passing score, optional shuffle and answers shown after
- deletes have consequences: deleting a card removes its marks; deleting a question keeps past scores; deleting a lesson loses saved positions

**Reviews:**
- staff curate them by hand, copied word for word from stores; there is no customer submission or moderation queue
- every review shows on its product page and its exam page
- Home shows up to 9 pinned reviews; the first 9 are pinned by default (1145)
- Home hides the reviews section when there are none (874)

**FAQs:** answers should be at most 400 characters ("short and direct" for AI quoting), are published as FAQ structured data, and can include an optional real review quote.

**Store links:** the product link falls back to the shop link from Settings. If the shop link is empty, that store's button is hidden (applies to Lazada and TikTok).

**Rankings:** Home best sellers and the exam-page product order are by units sold, which is entered by hand from Shopee.

**Admin rules:** the Owner can't be removed; Editors can't see orders, change prices or manage admins; denied sign-in attempts are logged.

**Pricing display:** PRICE FROM plus optional PRICE UP TO. The list shows "₱400+" for a range. Variations carry their own prices.

---

## 7. Integrations implied

- **Google OAuth** for admins (allowlist plus invites) and for members ("· Google").
- **PayMongo:**
  - methods QR Ph, GCash, Maya and Card
  - payment-intent refs (`pi_…`)
  - webhook confirmation that auto-grants access
  - a "Check status with PayMongo" API call
  - a dashboard deep link
  - refunds handled in PayMongo
  - no card storage
- **Transactional email:** admin invites, member notices on extend/grant, "Send test email", and the support mailto from the member app.
- **Protected video service:** DRM, watermarking, resumable uploads up to 4 GB, a 100 GB storage quota, and duration extraction.
- **PDF processing pipeline:** split pages to images, a background job, detection of password-protected files, 200 MB limit, and storage and deletion of originals.
- **Object/image storage:** product photos, card back images, course covers, 1200×630 share images and the exam header image.
- **SEO/AEO/GEO:** Product, Organization, Breadcrumb and FAQ structured data; auto sitemap; "Summary for AI assistants".
- **Analytics and event tracking:** paid-sales series, active members, cards marked, reviewer opens, quiz averages, last active, and session/device metadata.
- **CSV export.**
- **Marketplaces:** outbound links only. Ratings, review counts, units sold and reviews are copied by hand ("Copy these from the Shopee listing"). There is no Shopee, Lazada or TikTok API sync.

---

## 8. Links to the Website and Member App

**Website** (the "View page ↗" links target `Exam.dc.html?exam=CE`, `Product.dc.html?id=…`, `Home.dc.html`, `Products.dc.html`, `FAQ.dc.html`, `About.dc.html`, `Legal.dc.html?doc=…`):
- exam page sections and SEO
- the Home promo banner
- the product catalogue (cards, product pages, IN APP tag, "See plans", store buttons, structured data)
- the Home best-sellers ranking
- reviews (product page, exam page, Home pins)
- the FAQ page
- global store and social links used in buttons and the footer

**Member App** (the denied screen links to `MemberApp.dc.html`):
- the **Library**: Exam › Subject › Topic reviewer pages
- flashcard decks and quizzes by topic
- courses, modules and lessons with resume and free preview
- the **Plans page**: plan cards, best-value badge, per-month price
- the **Billing page** for manual renewals
- the renew prompt
- the "Payment didn't go through" screen
- the exam list, which grows when a "course" is added
- the **Email Support** button
- the one-device session rule
- the member's exam and exam date
- progress stats

---

## 9. Ambiguities and open questions

1. **No marketplace-to-member link.** There are no access codes and no order import, so there is no way to give physical buyers app access. Confirm this is intended, since "access code" was expected.
2. **Two entitlement models conflict.** Plans unlock content *types* per exam, while each reviewer has a per-item "INCLUDED IN" (All-Access / PSAD Masterclass / Free preview). Deck meta always says "CE ALL-ACCESS". Which is the source of truth?
3. **The one-time course price is entered in two places:** Course settings "ONE-TIME PRICE" and Plans "One-time purchases". Does "Sold separately" create the Plans entry automatically?
4. **"Course" means two things.** "+ Add course" in Uploads adds an exam/program (ChE, Nursing). "Courses & videos" are video courses. Uploads allows new exams, but Products, CMS, Flashcards and Plans hard-code 5 exams. The 6 "soon" exams in aycData are not handled at all.
5. **Subject taxonomy mismatch.** Product subjects (e.g. ME "Power & Industrial Plant", EE "EE PROF. SUB.", MT "Clin Chem", CPA "AUD THEORY") don't match the `EXAM_INFO` codes (PIP, EE PROF, CLIN CHEM, AUD), so the product editor's subject chips won't preselect for non-CE products. Course SUBJECT is free text. A canonical Subject entity is needed.
6. **Role gating is not shown.** Can Editors see Users? Does "change prices" cover physical product prices? The nav is identical for every role.
7. **Hidden CMS scope.** Full editable definitions for About, Products, FAQ, Privacy, Terms and Menu/footer exist in code (974–1020) but v2 states those are "fixed… through the developer". Decide the CMS scope. About content is marked "needed from client".
8. **Promo banner start.** STARTS ON exists, but the alert says "Turn it on… when the next sale starts". Is the start automatic or manual? The "Turn off banner" modal has no trigger.
9. **Ratings source conflict.** The product editor says to copy figures by hand, but a legacy flag says "Ratings from Shopee: ON" (976). Is any automation wanted?
10. **Review store.** The review list meta always shows "SHOPEE" (1150) even though a STORE field exists. aycData reviews have no source, author or date.
11. **FAQ count.** The FAQ section summary says "16 in 5 groups", but the data has 17 (3+3+4+5+2). Groups can't be managed.
12. **Pending-order sample data contradicts itself.** AYC-10479 is dated 13 Oct yet "Oldest is 18 hours old", and pending orders expire after 24 hours. What status follows expiry?
13. **Contact details conflict.** Settings uses support@aceyourcourse.ph; aycData CONTACT uses aceyourcourseinc@gmail.com plus Facebook and Instagram. Settings has only a TikTok profile, with no FB/IG fields.
14. **Pending catalogue items.** The 7 "pending" placeholder products (price ₱0, shop-page URL) show up in the admin list with no "coming soon" control. Their Shopee "link" is the shop URL but is counted as a product link (green).
15. **No history UI.** The extend/grant reason is "saved in the history", but no admin audit log or member history screen exists.
16. **Possible mismatch.** EE Flash Cards is "in app" while the EE plan is off sale, so the site would show "See plans" with nothing to buy. Should one block the other?
17. **Unwired controls:** "+ Add topic", quiz "Add image", "Open in PayMongo dashboard", the static `reviewEdit`/`faqEdit` screens (with an extra "ORDER IN GROUP" field), and "drag to reorder" photos.
18. **Unused leftovers.** Many values in `renderVals` are never used by the template (1593–1625). They include an older Home section list ("Find your exam · 11 exam tiles", "Formats · 4 format rows", "Authenticity · IPOPHIL stamp + 3 steps", "Where to buy"), "SLIDES" wording for PDFs, and user counts (All 612 / Active 496 / Expired 116 / Admins 2). Treat them as earlier intent, not spec.
19. **Sample numbers don't reconcile.** Plan "ACTIVE" counts total about 545 against 496 active members. "PAID TODAY · 9 orders" doesn't match the order list, which has no 22 Oct orders.
20. **No inventory or out-of-stock handling,** despite `variations[].inStock` in aycData.
