> Build map of the **website** mockup, generated on 2026-10-29 by reading the source in full. Line numbers refer to the files in `docs/mockup/website/`. It is a reference, not a spec: the "Ambiguities" listed here were resolved during planning, and `docs/specs/` and `docs/adr/` win wherever they disagree with this map.

# AYC Website mockup: build map

All Website files have now been read in full: the 12 `.dc.html` files and `_template.html`. I also checked the small JS support files. `30883ca8…js` remaps asset and Shopee CDN URLs, `51857e22…js` is `motion.js` (scroll and entrance animations), and `f76e9de2…js` is the generic dc-runtime. None of them contains app logic.

File names on disk carry a hash prefix, for example `Home_v2.dc.html`. Below I cite them by short name with approximate line numbers. Every page loads data with `import('ayc-data.js')`, which resolves to `aycData.js` (for example Home_v2 L293). The Website uses `PRODUCTS`, `EXAMS`, `EXAM_INFO`, `STORES`, `SUBJECT_NAMES`, `byId`, `bySold` and `peso`. It never uses `SHOP`, `CONTACT` or `stars`; those values are hardcoded instead.

---

## 1. Purpose, audience, positioning, tone

**Audience.** Filipino board-exam reviewees: students, fresh grads, retakers and OJT/working professionals taking CELE, MELE, REE, MTLE or CPALE. Some copy uses Taglish, and the reviews are left as-is in Taglish.

**Core positioning.** The headline is *"Remember every formula on board day."* (Home L20), with the pill *"LICENSURE EXAM REVIEWERS · MADE BY PASSERS"*. The sub-headline: *"Flash cards, notebooks, and posters for board exam review in various courses. Shipped nationwide, and also available in the app."* The brand line in the footer and About is *"Built by board passers. Designed for dreamers."*

**Value props, repeated across pages:**
- **Made by passers.** *"Everyone behind AceYourCourse has taken a board exam and passed. We make the reviewers we wish we'd had, then pack and ship every order ourselves from Iloilo City."* (About L19)
- **Follows the board's own subjects.** *"Every reviewer is built around your board's subjects, so you only study what shows up."* (Home L69)
- **Saves time.** The story is that people hand-copy formulas onto index cards and manila paper the night before (About L50–58). The FAQ says the product is a *"recall and practice kit… alongside a review center or self-review."*
- **Physical build quality.** 4 × 6 in cards on 160 gsm paper, A3 posters you can read "from 6 ft away", A5 notebooks.
- **Original and IPOPHIL-registered** (anti-piracy). *"Copies are going around. Make sure yours is the real one."* (Home L247)
- **Budget-friendly.** *"Help more reviewees walk out of the exam room as registered professionals, without spending more than they have."* (About L93). Per-subject buying and SPayLater 0% are also pushed.
- **Physical plus app.** *"Same content. Two ways to study it."* (Products L123). *"Physical copies from our official stores. Digital in the app."* (Home L260)
- **Honest reviews.** *"Most are five stars. Not all of them, and we leave those up too."* (Home L219)

**Tone.** Warm, plain, a little playful ("our dear future board passers", "Future RCE, RME, REE, RMT, CPA" on a mock shipping label). The visual style is neo-brutalist: cream #F6F1E7, navy #0E1A2E, orange #FF881F and blue #005AA5, with hard shadows and Schibsted Grotesk plus JetBrains Mono type.

**The site is a catalogue and funnel, not a store.** Physical sales go out to the marketplaces. Digital sales go to the Member App.

---

## 2. Sitemap and routing

**Pages:** Home (`Home v2`), Products (list), Product (detail), Exam (per board), Reviews, FAQ, About, Legal (privacy or terms).

**Prototype routing** (`_template.html` L341–379). This is a single-page shell that intercepts clicks on any `X.dc.html` link:
- The page aliases are mapped in `MAP` (L342), so `Home`/`Home v2`, `Exam`/`Exam v2`/`ExamCE`, `Products`/`Products v2` and so on are equivalent. The mockup mixes `v2` and non-`v2` link names freely.
- The URL becomes the hash route `#!/{page}?{query}` (L346, L369), for example `#!/product?id=27980584601`, `#!/exam?exam=CE` and `#!/legal?doc=terms`.
- Anchors after `#` are smooth-scrolled (L372), for example `Home v2.dc.html#exams`.
- Defaults (L378): `exam='CE'`, `pid=''` and `doc='privacy'`. The Product page then falls back to `27980584601` (CE Posters) when there is no id, or to `PRODUCTS[0]` when the id is unknown (Product L154–155).
- The mobile breakpoint is `innerWidth < 760` (L350).
- `EXT` (L343) sends `MemberApp.dc.html` to `AceYourCourse Member App.html`. It also maps `AdminDashboard` and `AdminMobile` to `AceYourCourse Admin.html`, but **no Website page links to the Admin**.

**URL and query patterns in use:**
- `Product.dc.html?id={productId}`. Ids are Shopee item ids, or `p-*` slugs for pending items.
- `Exam.dc.html?exam={CE|ME|EE|MT|CPA}` (also `Exam v2.dc.html?exam=`). Soon exams get `href '#'` in the data.
- `Legal.dc.html?doc={privacy|terms}`
- In-page anchors: Home `#exams #formats #video #reviews #authenticity`; Products `#picker #all`; Exam `#reviewers`; Reviews `#wall`; About `#story`; FAQ `#faq-{ship|paper|cover|shopee|auth}`; Legal `#s1…#s8`.

**Header: SiteNav.dc.html**
- **Announcement bar** (L12–17, L101–104). It rotates every 4.5 s and can be dismissed, but the dismissal is held in state only and is not saved. Messages and targets:
  - "Physical copies on Shopee, Lazada & TikTok Shop" goes to Products.
  - "Digital reviewers in the app · no auto-renew" goes to MemberApp.
  - "Ships from Iloilo City · SPayLater 0% on Shopee" goes to FAQ.
- **Logo** goes to Home.
- **Desktop nav.** First an **Exams** mega-menu (hover or click, closes on Esc; L48–70). It holds 5 exam tiles (code, name, board), each going to `Exam v2.dc.html?exam=`. Next to them is a column *"ON SHOPEE · PAGES COMING SOON"* with dashed, non-clickable chips: Pharmacy, Teachers, Fisheries, Master Plumber, Physical Therapy, Psychometrician. That column also has "Browse all reviewers →", which goes to Products. After the mega-menu come **Products · Reviews · About · FAQ** links, with an active underline set by the `active` prop.
- **Right side.** "Sign in" and "Start reviewing →", both linking to `MemberApp.dc.html` (L32–33).
- **Mobile.** "Sign in" plus a burger. The drawer holds an exam code grid, the 4 links, "Sign in" and "Start reviewing" (both to MemberApp), and a **"PRINTED COPIES"** row with Shopee ↗, Lazada ↗ and TikTok ↗ links to the shop roots (L84–93).
- The exam list and the soon list are **hardcoded** here (L122, L125) rather than read from `EXAMS`.

**Footer: SiteFooter.dc.html (L10–34)**
- Headline: "Built by board passers. Designed for dreamers."
- "Where to buy": *"Physical copies from our official stores, shipped nationwide. Digital reviewers in the app."* Then Shopee ↗, Lazada ↗ and TikTok Shop ↗.
- **EXAMS column:** the 5 exams (`Exam.dc.html?exam=`), plus "See other courses →", which goes to `Home v2#exams`.
- **SHOP column:**
  - All products goes to Products.
  - Reviews goes to **`Home#reviews`**, not the Reviews page.
  - "Spot a fake copy" goes to `Home#authenticity`.
  - "Sign in to the app" goes to MemberApp.
- **COMPANY column:** About us, FAQ, Privacy Policy, Terms of Use.
- **FOLLOW column:**
  - TikTok @aceyourcourse (`tiktok.com/@aceyourcourse`, which is different from the TikTok Shop link)
  - Facebook @aceyourcourseph
  - Instagram @aceyourcourseph
  - "Shopee · 3.7K followers"
- Bottom line: *"© 2026 AceYourCourse · Registered with IPOPHIL. Unauthorized reproduction is prohibited."* and *"★ 4.8 · 874 ratings · Ships all over the Philippines"*. These values are hardcoded.

---

## 3. Sections per page, with their CTAs

**Legend:** **EXT-SHOP** means an external link in a new tab to Shopee, Lazada or TikTok. **APP** means a link to `MemberApp.dc.html`. **There is no cart, checkout, price-payment form or email capture anywhere on the Website.**

### Home (Home_v2.dc.html)

1. **Hero** (L14–63)
   - The promo video plays as a muted, looping background with a poster frame.
   - H1 and sub-headline as quoted above. Trust line: "★★★★★ 4.8 FROM 874 RATINGS · IPOPHIL REGISTERED".
   - CTAs: **"Find your exam ↓"** (`#exams`), **"Try the app free"** (APP) and **"▶ Watch 1 min"** (`#video`).
   - **"TRY A CARD · TAP TO FLIP" widget** (L33–57, data L275–279). Three hardcoded sample cards:
     - CE/HPGE "Major head loss"
     - ME/MATH "Potential energy"
     - EE/ESAS "Wave motion"
   - The front shows the topic and the back shows the actual card PNG (`assets/card-*.png`). It auto-flips every 3.2 s until the user touches it. It has exam-code dots, "OTHER COURSES →" (switches the exam picker to Other and jumps to `#exams`) and "Next card →".
   - **Ticker** (L316), hardcoded: "Licensure exam reviewers · ★ 4.8 shop rating · Updated & high yield · 874 ratings · Trusted by students · IPOPHIL registered · Made by board passers · Ships nationwide · CE · ME · EE · MT · CPA".
2. **"Four steps to your reviewer"** (L66–84, data L317–321)
   - 01 "Pick your board exam" → `#exams`
   - 02 "Choose physical, app, or both" (*"The app includes other features including quizzes and reviewers."*) → `#formats`
   - 03 "Review anywhere" (*"…a countdown to your exam date in the app"*) → `#reviews`
   - 04 "Watch anywhere" (*"Access video lessons and courses for every topic, anytime, right in the app."*) → **"See app plans"** (APP)
3. **"Find your exam" `#exams`** (L86–137, logic L326–338)
   - Tabs: the 5 active exams from `EXAMS.filter(!soon)`, plus a "+ Other courses" tab.
   - The panel shows code, `EXAM_INFO.name`, `board · long`, `blurb`, and a "SUBJECTS COVERED" chip for each subject (code, with the name as a tooltip).
   - CTAs: **"All {code} reviewers →"** (Exam page) and **"Review {code} in the app"** (APP). The app CTA shows only if any product for that exam has `digital`.
   - Right column, "STEP 2 · CHOOSE A FORMAT · N REVIEWERS": a row for each product of the exam, sorted by units sold. Each row shows thumbnail, format, the "ALSO IN APP" badge, short name, ★ rating, sold count and price label, and links to the **Product page**.
   - **Other tab:** a row for each soon exam, linking to the Shopee shop root with "COMING SOON · SHOPEE ↗", plus "Browse on Shopee ↗". Blurb: *"More courses are coming soon. Reviewers for these exams are already on our official stores."*
   - Under the panel: "COMING TO THE SITE:" PhLE, LET, FTLE, MPLE, PTLE, PmLE, then "Already on Shopee ↗".
4. **Best sellers** (L140–172, L341–342)
   - "RANKED BY UNITS SOLD ON SHOPEE". The top 6 by `sold` in a horizontal snap carousel with ←/→ buttons.
   - Each card shows a rank badge (#1 in orange), exam · format, short name, ★ rating · ratingCount, price, and a sold-progress bar relative to #1. Cards go to the Product page.
5. **Formats `#formats`** (L174–197, L344–348)
   - Heading *"Which format fits how you study?"*, with *"Most passers mix two: cards for recall on the go, posters for the wall you stare at while solving."*
   - Four cards. Copy and "FROM" prices are **hardcoded**; images come from specific product ids.

     | Format | Size | For | From |
     |---|---|---|---|
     | Flash cards | 4×6 in · 160 gsm | CE·ME·EE·MT·CPA | ₱550 |
     | Notebook | A5 | CE·ME·EE·MT | ₱699 |
     | Posters | A3 | CE·ME·EE·MT | ₱400 |
     | Bundle | cards + notebook + posters | CE | ₱3,499 ("₱200 less than buying each separately") |

   - Every card goes to the Products page **unfiltered**.
   - App band: *"PREFER YOUR PHONE? Flashcards, scored quizzes, reviewers, and video lessons in the app, with a countdown to your exam."*, linking to **"See app plans →"** (APP).
6. **Brand video `#video`** (L200–212). "WATCH · 1 MIN", headline *"See what's inside before you order."*, sub-line *"A minute with the cards, notebooks, and posters, from the people who made them."* Then a video player with controls.
7. **Reviews `#reviews`** (L214–235, L349–351)
   - Labels "COPIED WORD FOR WORD FROM SHOPEE" and *"Pinned by reviewees"*. A badge reads "4.8 · 874 shop ratings".
   - Two marquee rows of ReviewCards that pause on hover. The **10 reviews are hand-picked by (productId, index)**, and one of them is the 3★ MedTech notebook review.
   - CTA: "Read every review on Shopee ↗" (EXT-SHOP).
8. **Authenticity `#authenticity`** (L237–256)
   - An IPOPHIL stamp, then *"Our reviewers are registered with IPOPHIL and protected by copyright law. Photocopies and PDFs sold elsewhere aren't ours…"*
   - Three steps: buy only from the official stores; check the listing says "Ships from Iloilo City"; *"Look for the established reviews… A new shop with our photos is a red flag."*
9. **Store band** (L258–268). *"Physical copies from our official stores. Digital in the app."* Buttons: Shopee ↗, Lazada ↗, TikTok Shop ↗ (shop roots) and **"Open the app →"** (APP).
10. Footer.

### Products (Products_v2.dc.html)

1. **Hero** (L14–31)
   - Pill "ALL REVIEWERS · 5 BOARD EXAMS". H1 *"Find the reviewer that fits how you study."* Sub-line *"…for CE, ME, EE, MT, and CPA. Shipped nationwide. Most are also in the app."*
   - CTAs: "Help me choose" (`#picker`) and "Browse all ↓" (`#all`). Then a ticker.
2. **"Help me choose · 2 questions"** (L33–65, logic L153–158 and L184–190)
   - Question 1: the board (5 buttons). Question 2: "How do you like to study?" with five options: On the go, On my wall, Solving problems, Everything, App.
   - Each option maps to preferred formats. The match is the first non-pending product of that exam in best-seller order, falling back down the list. The app option picks the first `digital` product.
   - Result: thumbnail, name, price and a "why" sentence. CTAs: **"View reviewer →"** (Product page) and "See all {exam} reviewers" (sets the grid filter and scrolls).
   - The "App" option is labelled "START IN THE APP", but its CTA still goes to the Product page.
3. **"All reviewers" `#all`** (L67–117, logic L191–199)
   - A sticky filter bar:
     - search across short name, title, exam, board, format and subjects
     - sort: Best selling (default), Price low→high, Price high→low, Top rated
     - "Also in app" toggle (`digital`)
     - Exam chips with counts
     - Format chips (Flash cards, Posters, Notebook, Bundle) with counts
     - **MAX PRICE** slider from ₱400 to ₱3,500 (step 50, "Any" at the top end). It filters on `price`, which is the minimum price.
     - "Clear filters"
   - Count label: "N OF 15 REVIEWERS".
   - Card (L88–108): image with the second image on hover, exam and format badges, "ALSO IN APP", name, up to 4 subject chips plus "+N", ★ rating (count), sold, and price label.
   - **Three buy buttons on each card:**
     - **"Shopee ↗"** goes to `p.url`, the per-listing deep link, or the shop root for pending items.
     - **"Lazada ↗"** and **"TikTok ↗"** go to the **shop roots** (hardcoded).
   - Empty state: *"No reviewers match those filters. … Reviewers for PhLE, LET and other boards are on Shopee already."* Buttons: Clear filters and Browse Shopee ↗.
4. **"PHYSICAL OR APP?"** (L120–146). *"Same content. Two ways to study it."*
   - The Physical column (SHOPEE · LAZADA · TIKTOK SHOP) says *"Pay once, keep it. Ships nationwide."*
   - The "In the app" column is tagged **"PAID PLAN · NO AUTO-RENEW"** and lists: *"Flash cards that track which ones you still need to review"*, *"Scored quizzes, PDF reviewers, and video lessons"* and *"A countdown to your exam date, on your phone."* Its CTA is **"See app plans →"** (APP).
5. Footer.

### Product detail (Product.dc.html)

1. **Breadcrumb** (L15): PRODUCTS (Products page) / {board} (Exam page) / {short}.
2. **Gallery** (L18–31): main image, "i / N" counter, and thumbnails in an 8-column grid.
3. **Info column**
   - Badges: `exam · board`, `edition` if present, `format`. H1 is `title`. Below it: ★ `ratingLabel`, `ratingCount` ratings, `soldLabel`.
   - **Price** (L46–48, L162):
     - with variations, the price of the selected variation
     - else with `priceMax`, a range "₱600–1,550"
     - else the single price
   - When `deal` is set, a badge reads **"SHOPEE: ANY 2 ENJOY 4% OFF"**.
   - **VARIATION list** (L51–65, L161). Radio-style buttons with the label minus its "PREFIX: " part and a price per variation. "IN STOCK" is printed on every one (the `inStock` field is ignored).
   - Without variations, a dashed box reads either *"Sold per subject or as a full set. Pick your option on the store page: ₱X to ₱Y."* or *"One option: the complete set."* (L163).
   - **SUBJECTS COVERED**: a code plus full name for each subject, looked up in `EXAM_INFO.subjects` and then `SUBJECT_NAMES` (L164–165).
   - **Specs**: FORMAT, SIZE, and "SHIPS FROM Iloilo City" (hardcoded).
   - **Buy box** (L83–90). Header "PRINTED COPY · {price} · SHIPS FROM ILOILO CITY", then **"Shopee ↗"** (`p.url`), **"Lazada ↗"** and **"TikTok Shop ↗"** (`STORES` shop roots). The chosen variation is not passed through.
   - **Digital band**, when `digital` (L91–96): *"ALSO AVAILABLE IN THE APP — The same content one card at a time, plus scored quizzes and reviewers. Included in {exam} All-Access."* It links to **"See plans →"** (APP). Otherwise a note reads *"PRINTED ONLY · NOT AVAILABLE IN THE APP."*
4. **Description** (L104–112). All of it is generated or boilerplate:
   - "01 What's inside": `"{format} for the {board}, covering {subjects}. For the board exam, school, and professional review."`
   - "02 Made for": `{name} students`, "Board exam reviewees" and `EXAM_INFO.for3`.
   - "03 Authentic copies only": the IPOPHIL text.
5. **Reviews** (L114–130). The product's rating and "{n} ratings on Shopee", then **all** of the product's reviews in a 3-column masonry. With none: *"No written reviews yet. This one is new… Bought it? Leave a review on the store you ordered from."*
6. **More** (L132–139, L171–173). "More for the {board}" shows the same exam's products by units sold (max 3). If there are none, it shows "Best sellers from other boards". It uses the ProductCard component (the only place it appears), which carries the "Any 2 · 4% off" and "IN APP" badges and the text "SHOPEE · LAZADA · TIKTOK SHOP".

### Exam (Exam_v2.dc.html)

1. **Hero** (L14–50)
   - Breadcrumb "EXAMS" goes to `Home#exams`. There is an in-page CE/ME/EE/MT/CPA switcher; it changes state only and **does not update the URL** (L245).
   - A large code block, `board` and `long`, H1 `name`, `blurb`.
   - CTAs: **"See N reviewers ↓"** (`#reviewers`) and **"Review {code} in the app"** (APP, shown if any product is digital).
   - Stats, all computed (L252–263): REVIEWERS (count, pending included), UNITS SOLD (sum), AVG RATING (weighted by `ratingCount`) and FROM (minimum non-pending price).
   - A stack of the top 3 non-pending product images, each linking to its Product page. Then a ticker of "CODE · Subject name".
2. **"What's covered"** (L52–71). "{n} SUBJECTS ON THE {board}", numbered cards from `EXAM_INFO.subjects`.
3. **"Every {code} reviewer" `#reviewers`** (L73–104). "BEST SELLING FIRST", format filter chips (only when there is more than one format), and cards. Each card has format, "ALSO IN APP", "#1 IN {code}" on the top seller, name, size, ★ rating · count, sold and price, and links to the **Product page**. There are no buy buttons here.
4. **"Which one should I get?"** compare table (L106–125, shown only with more than one product). Columns: reviewer (link), format · size, BEST FOR (a hardcoded map by format, L220), IN THE APP (YES or PHYSICAL ONLY), price.
5. **"TRY A {code} CARD"** (L127–161). Heading *"One formula a card. Flip, recall, repeat."* and *"The app works the same way, and remembers which cards you need to see again."*
   - Three **hardcoded formula cards per exam** (L213–219), for example CE "T = R tan(I/2)" and MT "LDL = TC − HDL − TG/5".
   - CTAs: **"See {code} app plans →"** (APP, if digital) and "Get the printed set" (the top seller's **Product page**).
6. **CE only: bundle banner** (L163–170). Hardcoded: *"CE REVIEW BUNDLE 3-IN-1 · SAVE ₱200 — Cards, notebook, and posters for MSTC, HPGE, and PSAD in one order. ₱3,499"*, linking to `Product.dc.html?id=55314794259`.
7. **"From {code} reviewees"** (L172–195). The first 7 reviews across the exam's products, in best-seller order. Four or more show as a marquee, one to three as a grid, and none as *"No written reviews yet. Buyers have left star ratings on Shopee but no comments so far."*
8. **Store band** (L197–206). *"Get your {code} reviewer from our official stores."* Buttons: Shopee, Lazada, TikTok Shop (shop roots).
9. Footer.

### Reviews (Reviews_v2.dc.html)

1. **Hero** (L14–30). H1 *"What reviewees say after using them."* and *"Every review here was written by a verified buyer on our Shopee shop, copied word for word, including the critical ones."* Hardcoded stats: 4.8 SHOP RATING ON SHOPEE, 874 RATINGS, 3.7K FOLLOWERS.
2. **"Ratings by reviewer"** (L32–48, L127–128). One row per product in best-seller order, **pending items included at 0.0**. Each row has exam, short name, a rating bar and "{n} ratings". Clicking a row filters the wall to that product and scrolls to it.
3. **"The review wall" `#wall`** (L50–82, L117–130)
   - Search covers text, product and variation; the placeholder reads "font size, delivery, paper…".
   - Sort: Most helpful (default), Highest rated, Most critical, Most detailed (by text length).
   - Exam chips and star chips (All, 5★, 4★, ≤3★), each with counts, plus a removable product chip and "Clear filters".
   - Count: "N OF 16 WRITTEN REVIEWS". Each ReviewCard has "VIEW PRODUCT →" (Product page).
   - Empty state: *"Newer reviewers like the MedTech flash cards have ratings on Shopee but no written reviews yet."*
4. **"Passed with our cards?"** (L84–95). *"Send us a message! We would like to feature you and your story."* Buttons: "Email us" (`mailto:aceyourcourseinc@gmail.com`) and "Browse reviewers" (Products). **There is no on-site review form.**

### FAQ (FAQ_v2.dc.html)

- **Hero.** "FAQ · 17 ANSWERS", H1 *"Questions reviewees always ask"*, and the support email aceyourcourseinc@gmail.com.
- **Search**, with placeholder "Search: shipping, SPayLater, two devices…".
- **POPULAR chips** (L153): ship-from, auto-renew, two devices, original.
- Sticky TOPICS nav with counts, plus Expand all and Collapse all.
- Accordions. The first one is open by default. Some answers carry a "FROM A REVIEW" quote, and one carries the coverage table, whose rows link to the Exam pages.
- No-results state: Clear search, and "Chat us on Shopee ↗".
- **"Still have a question?"** band: "Email us" (mailto) and "Chat us on Shopee ↗" (shop root).
- The full content is quoted in §5.

### About (About_v2.dc.html)

1. **Hero.** H1 "Built by board passers. Designed for dreamers." CTAs: "Read our story ↓" and "See the reviewers" (Products). The photo `about-team-studying.jpg` carries an "IPOPHIL REGISTERED" sticker. **Hardcoded stats** (L172): **29 REVIEWERS · 11 BOARD EXAMS · 4.8★ 874 SHOP RATINGS · 3.7K SHOPEE FOLLOWERS**.
2. **Story `#story`.** *"We passed. Then we made what we wished we had."* A before/after panel: hand-copied cards against "Made properly, by the exam's subjects", with chips 4 × 6 IN, 160 GSM, BY SUBJECT, POSTERS, NOTEBOOKS.
   - Timeline "HOW IT GREW" (L174):
     - FIRST: Civil Engineering flash cards.
     - NOW: *"…reviewers for more courses: ME, EE, ChE, MedTech, Nursing, CPA, MP, LET, Fisheries, Architecture, and more."*
     - TODAY: still growing.
   - Then "And this is only the beginning." and three photos (handover, mother and daughter, hug).
3. **"The mission"**: a 4-tab principles panel (L163–167):
   - 01 Board-focused, nothing extra
   - 02 Updated to the trend (*"Our CE flash cards are already on their second edition."*)
   - 03 Made for tight budgets (*"CE posters from ₱400, EE cards at ₱600 per subject, MedTech cards at ₱550 per module. SPayLater 0% on every listing."*)
   - 04 Original, and protected
4. **"Iloilo City roots"**: *"Packed in Iloilo. Shipped to wherever you're reviewing."* and *"We're a small Visayas shop…"* Buttons: Shopee, Lazada, TikTok Shop, plus the mock "SHIPPING LABEL · VIA SHOPEE".
5. **CTA**: *"Your turn. Find the reviewer for your board."* Tiles for CE, ME, EE and MT (**CPA is missing**) go to the Exam pages. "+ Other courses" goes to `Home#exams`.

### Legal (Legal.dc.html)

Tabs switch between Privacy Policy and Terms of Use. The header reads **"VERSION 1.0 · EFFECTIVE 1 DEC 2026 · DRAFT FOR LEGAL REVIEW"**. Then an "IN SHORT" 5-point summary, a CONTENTS anchor nav, and 8 sections. Content is in §5.

---

## 4. Entities and fields read

**Product** (from `PRODUCTS`). The pages read:
- identity and naming: `id`, `exam`, `board`, `short`, `title`
- physical details: `format`, `size`, `edition`
- buying and pricing: `url` (Shopee listing), `price` (min), `priceMax`, `deal`, `pending`, `variations[{name, price, inStock*}]`
- ratings and sales: `rating`, `ratingCount`, `sold`
- content: `subjects[]`, `images[]`, `reviews[]`
- derived fields: `digital`, `href`, `target`, `img`, `priceLabel`, `soldLabel`, `ratingLabel`, `subjectsLine`

`inStock` is never read. `target` and `subjectsLine` are used only by ProductCard.

What each page reads:
- **Products page:** additionally uses `images[1]` (hover image), and searches `title` and `board`. It sorts on `price`, `sold`, `rating` and `ratingCount`.
- **Product page:** all of the fields above.
- **Exam page:** `size`, `sold`, `ratingCount`, `rating`, `pending`, `reviews`.
- **Home page:** `sold` (for rank and the progress bar) and `ratingCount`.

**Review fields:** `stars`, `text` (line breaks preserved), `variation` (shown as "not specified" if null), `helpful` (shown only if above 0), and `product`/`exam` injected by the data layer.

**Exam fields:**
- from `EXAMS`: `code`, `board`, `name`, `soon`
- from `EXAM_INFO`: `name`, `long`, `blurb`, `for3`, `subjects[[code, name]]`

`EXAMS.meta`, `tabX` and `count` are not used on the Website.

**Subject:** there is no entity. Subjects are free strings on the product, `[code, name]` pairs in `EXAM_INFO`, the CE-only `SUBJECT_NAMES` map, and a separate hardcoded list in the FAQ coverage table.

**Stores:** `STORES` is used only on the Product page and the Home "Other" tab. Everywhere else the store URLs are hardcoded.

**Hardcoded instead of read from data**, which a planner needs to model:
- Shop stats (4.8 / 874 / 3.7K). They appear in the Home hero and reviews badge, the Reviews hero, the Footer and About.
- About stats: 29 reviewers, 11 exams.
- Contact emails and social links.
- Nav exam list and soon list.
- Home ticker, steps, the 4 format cards (prices and copy), the 10 hand-picked reviews, and the 3 flip-card PNGs.
- Exam page: sample formula cards for each exam, the BEST-FOR map, and the CE bundle banner (₱3,499, save ₱200, product id).
- The "SHIPS FROM Iloilo City" spec.
- FAQ content, including per-subject prices and the coverage table.
- FAQ review quotes (see §8).
- Legal text.
- Product descriptions (template sentences, not a data field).

---

## 5. Business rules and policy text

**Pending products** (7 `p-*` items: CE Solving Notebook, ME Notebook, ME Posters, EE Notebook, EE Posters, MT Essentials Flash Cards, MT Essentials Posters):
- They show a placeholder image, "Price TBA", rating "New" and "New listing". Their Shopee link is the shop root.
- They count in "N reviewers" totals (Products "N OF 15", Exam REVIEWERS stat), in the exam and format chips, and in the Reviews ratings table (shown as 0.0).
- They are excluded from the Exam hero image stack, the FROM price and the picker's format match.
- **Bug:** on the Product page they show **"₱0"** and **"PRINTED COPY · ₱0"**, because `priceNow` uses `peso(price)` (L162). They also say "One option: the complete set" and "Buyers have left star ratings…" even though there are 0 ratings.
- Their price of 0 means they always pass the max-price filter, and "Price low→high" sorts them first.

**Soon exams** (PhLE, LET, FTLE, MPLE, PTLE, PmLE): there are no exam pages for them (`href '#'`). They are labelled "ON SHOPEE · PAGES COMING SOON", "COMING SOON · SHOPEE ↗" and "COMING TO THE SITE… Already on Shopee ↗", and link to the Shopee root.

**Digital versions** (`digital` comes from the `DIGITAL` id list, currently 5 products):
- Badges "IN APP" / "ALSO IN APP".
- The Products "Also in app" filter.
- The Product page band: *"Included in {exam} All-Access"*, linking to "See plans".
- The "PRINTED ONLY · NOT AVAILABLE IN THE APP" note.
- The compare-table column.
- Exam and Home "Review {code} in the app" CTAs, shown if any product for that exam is digital.

**Deals:**
- When `deal` is true, ProductCard shows "Any 2 · 4% off" and the Product page shows "SHOPEE: ANY 2 ENJOY 4% OFF". The Products and Exam grids do not show the badge.
- The CE bundle at ₱3,499 is "₱200 less" than cards ₱1,200 + notebook ₱1,249 + posters ₱1,250.
- SPayLater 0% is claimed for every Shopee listing.

**Variations and price ranges:**
- `priceLabel` reads "from ₱X" when `priceMax` is set.
- On the Product page, the selected variation sets the displayed price. Variation names are shortened by removing the "PREFIX:" part.
- Range items without variations (EE cards, MT comprehensive cards) tell the shopper to pick on the store page.

**Review display:**
- Home uses a curated 10, and deliberately includes the 3★ review.
- Exam shows the first 7 in best-seller order.
- Product shows all of its reviews.
- Reviews page: full filter and sort as described in §3.
- Ratings are labelled as Shopee figures throughout. Shop-level ratings (874) and product-level ratings (they sum to 514) are separate numbers.

**FAQ answers** (FAQ L111–133):
- **Shipping**
  - *"Every order ships from Iloilo via Shopee, TikTok, and Lazada. We ship daily…"*
  - *"Yes, we ship nationwide!"*
  - Tracking is *"In the Shopee, TikTok, or Lazada app under My Purchases."*
  - There is no stated delivery SLA, and **no returns or refunds policy for physical goods**.
- **Paper and print**
  - Cards are *"4 × 6 in, printed on 160 gsm board paper."*
  - Posters are *"A3 size, printed big enough to read from your desk."*
  - The notebook is A5.
- **What's covered**
  - *"Each reviewer follows that exam's board subjects. Topics are updated and based on recent exam trends"*, followed by the coverage table.
  - Single subjects: *"CE posters per subject: MSTC ₱400 · HPGE ₱470 · PSAD ₱700 / EE flash cards per subject: ₱600 each, or ₱1,550 for all three / MedTech flash cards per module: ₱550 each, or ₱2,750 for all six."*
  - *"Is it enough on its own?"* gets the recall-kit answer.
  - *"My exam isn't on the site yet."* is answered *"More courses are coming soon."*
- **Buying and the app**
  - *"Physical copies are sold through our official stores on Shopee, Lazada, and TikTok Shop. Digital access to flashcards, quizzes, reviewers, and video courses is available here in the app and paid through **PayMongo, including QR payments**."*
  - *"No. A subscription gives you access for a fixed period, like one month. When it ends, you renew it yourself from the **Billing page**. We never charge you automatically."*
  - *"You can **sign in with Google** on any device, but **only one at a time**. Signing in on a new device signs out the old one."*
  - The discounts answer covers the Any 2 4% offer and the bundle.
  - *"For physical copies on Shopee, every listing supports SPayLater at 0% interest."*
- **Authenticity**
  - The 3 steps (*"Every store link on this site goes there"*).
  - On PDFs and photocopies: *"No… registered with IPOPHIL… If you see one, send us the link through Shopee chat."*

**Privacy Policy summary:**
- *What is collected:* Google name, email and photo; exam and exam date; app activity (cards marked, quiz scores, lessons watched, resume point); payment records (item, amount, date, method, PayMongo reference, no card numbers); device and session (to enforce one active session).
- *Uses:* sign-in, content access, progress, **watermarking protected content with the user's email**, receipts and **access reminders**, support.
- *Sharing:* PayMongo, Google, hosting and video providers. No selling of data.
- *Law:* the Data Privacy Act of 2012 (RA 10173) and the NPC.
- *Retention:* while the account is active plus a period for tax and legal needs.
- *Rights:* access, correction, objection, deletion, portability, and complaint to the NPC.
- *Security:* HTTPS, restricted database access, and *"only authorised staff can open the admin dashboard."*
- *Contact:* DPO at privacy@aceyourcourse.ph.

**Terms of Use summary:**
- The terms apply to the website and the member app; signing in counts as acceptance.
- Use your own Google account, one device at a time.
- *"Subscriptions give access for the period shown at checkout and end automatically. **One-time purchases** give access as described on the product."* Payments go through PayMongo.
- **Refunds:** *"generally non-refundable, except where required by law or when access fails because of a problem on our side."*
- Content is IPOPHIL-registered and for personal review only.
- Prohibited: *"Screenshot, record, download, print, copy, share, or resell content; try to get around watermarks or access controls."*
- Printed copies are sold under the marketplace platforms' terms.
- Breaking the terms can mean suspension without refund.
- AYC may change content, plans or prices with notice.
- Contact: support@aceyourcourse.ph.

---

## 6. Links to the Member App and Admin

- **14 links to `MemberApp.dc.html`**, which goes to `AceYourCourse Member App.html`:
  - Nav: "Sign in" and "Start reviewing" (desktop and mobile)
  - Announcement "Digital reviewers in the app · no auto-renew"
  - Home: "Try the app free", step 04 "See app plans", "Review {code} in the app", the "PREFER YOUR PHONE?" band, "Open the app →"
  - Products: "See app plans →"
  - Product: "See plans →"
  - Exam: "Review {code} in the app", "See {code} app plans →"
  - Footer: "Sign in to the app"
- **There is no separate sign-up page, and no public pricing or plans page.** Every "plans" CTA lands in the app.
- **App concepts the Website commits to:**
  - Google sign-in, one active device, email watermark
  - Per-exam **"All-Access"** plan (Product L93)
  - Fixed-period plans with no auto-renew, renewed manually from the Billing page; one-time purchases are also mentioned
  - PayMongo checkout, including **QR payments**
  - Receipts and access reminders
  - Exam date countdown
  - Flashcards with spaced-recall tracking ("remembers which cards you need to see again"), scored quizzes, **PDF reviewers**, video lessons and courses, and progress or resume
- **Not present:** activation codes, QR codes on the printed product, redeem flows, any link between a marketplace purchase and app access, membership tiers beyond "All-Access", referral or affiliate features, and email capture.
- **Admin** is never linked. It appears only in routing (`_template.html` L343) and the privacy policy's "admin dashboard". From the Website, the admin would need to own: products and variations, digital flags, pending status, exams and the soon list, subjects, reviews (curation, pinning, order), shop stats, deal flags, the CE bundle, the FAQ, legal text and the announcement bar.

---

## 7. SEO and analytics hints

- **Nothing present.** The only head metadata is `<title>AceYourCourse Website</title>` plus charset and viewport (`_template.html` L3–4, L323). There are no meta descriptions, Open Graph or Twitter tags, canonical tags, JSON-LD, robots rules, sitemap, or analytics, pixel or UTM code (grep-verified across all files).
- **Hash routing** (`#!/…`) is not crawlable. The real build needs real routes, for example `/products/[id-or-slug]`, `/exams/[code]` and `/legal/privacy`.
- **Natural fits:**
  - `Product` schema with `AggregateRating` and `Offer`s pointing at the marketplace URLs, on Product pages
  - `BreadcrumbList` (Product and Exam pages already have breadcrumbs)
  - `FAQPage` (FAQ)
  - `Organization` with sameAs links to Shopee, Lazada, TikTok, Facebook and Instagram
  - Exam landing pages as keyword targets (CELE, MELE, REE, MTLE, CPALE reviewers)
  - Note: marking up reviews copied from Shopee as first-party reviews may conflict with Google's rules on self-serving review markup.
- **Analytics to plan:** the main conversion events are the outbound marketplace clicks (Shopee per listing or root, Lazada, TikTok) and the Member App handoffs. Also worth tracking: picker completion, filter use, video plays and FAQ searches.
- **Media:**
  - Product images are hot-linked from Shopee's CDN (`down-ph.img.susercontent.com`).
  - **Promo video `ayc-main-ad.mp4`** (59.4 s, 1280×720, H.264/AAC, **14.5 MB**) is used **only on Home**, in two places:
    - (a) the **hero background** at Home L15, autoplay, muted, looping, `preload="auto"`, poster `assets/ayc-main-ad-poster.png`
    - (b) the **`#video` section player** at Home L209, with controls and `preload="metadata"`
  - The hero preload is heavy for mobile. There are no captions on the player.

---

## 8. Ambiguities and open questions

1. **On-site checkout?** The mockup has none: physical goes to the marketplaces and digital goes to the app. Decide whether the Website ever sells physical stock directly.
2. **Lazada and TikTok links point only to the shop roots.** The data has no per-channel listing URL. Need `lazadaUrl` and `tiktokUrl` on each product, or accept shop-level links.
3. **Variation choice is not passed to the store link**, and **`inStock` is ignored** ("IN STOCK" is always shown).
4. **Pending products:**
   - "₱0" bug on the Product page
   - should they appear in counts, the ratings table and price sort?
   - should they have a purchasable Shopee link at all, or a "notify me"?
   - Example: the standalone CE notebook is pending, yet it is sold as a variation inside the CE bundle (₱1,249).
5. **Soon-exam messaging contradicts itself.** "Coming soon" and "pages coming soon" sit next to "Reviewers… are already on our official stores" and "PhLE, LET… are on Shopee already". About also lists ChE, Nursing and Architecture, which are not in `EXAMS`.
6. **Stats don't match the data.** About says "29 REVIEWERS · 11 BOARD EXAMS"; the data has 15 products (8 live) and 5 live exams. "Most are also in the app" when 5 of 15 are digital. The Home formats say notebooks and posters exist for CE·ME·EE·MT, but only the MT notebook and CE posters are live. The bundle is shown as "FROM ₱3,499" while its own range starts at ₱1,200.
7. **Shopee metrics.** Rating, ratingCount, sold, followers and the reviews are Shopee snapshots. Decide how they stay in sync (manual admin entry, import or scrape) and confirm permission to republish reviews "word for word". Two FAQ quotes are **not in the dataset** and need a source: *"Ang bilis din na deliver! Jan. 20…"*, attributed to the MedTech Essential Notebook, and *"Board paper pero not too thick…"*, attributed to CPA Flash Cards.
8. **Free versus paid.** "Try the app free" (Home hero) against "PAID PLAN" (Products). Is there a free tier or trial? Plan names and prices are absent: only "{exam} All-Access" appears, and Terms also mention one-time purchases.
9. **Physical-to-digital bridge.** Does buying a printed copy grant or discount app access, for example through a code inside the box? Nothing on the site says so.
10. **Subjects need a canonical entity.** Codes differ between product data, `EXAM_INFO`, the FAQ table and `SUBJECT_NAMES`: ME "Power & Industrial Plant" vs "PIP"/"POWER & IND. PLANT"; EE "EE PROF. SUB." vs "EE PROF"; CPA "AUD THEORY" vs "AUD"; MT "Clin Mic", "HTMLBE", "Micro & Para", "Hema 1&2". Because of this, the Product page's subject-name lookup falls back to the raw string for most exams.
11. **Contacts conflict.** aceyourcourseinc@gmail.com (FAQ, Reviews) against support@ and privacy@aceyourcourse.ph (Legal). Confirm the domain, and whether "Chat us on Shopee" stays the main support channel.
12. **Legal is a draft.** "DRAFT FOR LEGAL REVIEW, effective 1 Dec 2026." There is no physical returns or warranty policy (it is left to the platforms), no shipping-time statement, and no cookie or analytics disclosure, which will be needed once tracking is added.
13. **FAQ copy is written for inside the app** ("available here in the app"). Decide whether the Website and the app share one FAQ source.
14. **Product content is a placeholder.** The "What's inside" text is generated. Real products need description, contents, page and card counts, and edition notes. The sample formula cards and flip-card PNGs are hardcoded and need an admin-managed "sample card" asset per exam.
15. **Navigation quirks:**
    - The Exam page switcher doesn't update the URL.
    - The Footer "Reviews" link goes to Home#reviews instead of the Reviews page.
    - The Format cards go to Products unfiltered (they could pre-filter by format).
    - The picker's "START IN THE APP" result links to the Product page.
    - The About CTA leaves out CPA.
    - The announcement bar's dismissal isn't saved.
16. **Mobile.** The template passes `m` (below 760 px), but only SiteNav changes for mobile; everything else relies on fluid CSS.

## Key file paths

- `docs/mockup/website/_template.html` (routing and Member/Admin mapping)
- The same folder holds `Home_v2.dc.html`, `Products_v2.dc.html`, `Product.dc.html`, `Exam_v2.dc.html`, `Reviews_v2.dc.html`, `FAQ_v2.dc.html`, `About_v2.dc.html`, `Legal.dc.html`, `SiteNav.dc.html`, `SiteFooter.dc.html`, `ProductCard.dc.html`, `ReviewCard.dc.html` and `aycData.js`.
- Video: `the source zip's `export/assets/ayc-main-ad.mp4``