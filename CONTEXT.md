# Context

The shared vocabulary for this repository. This file is a glossary and nothing
else — no implementation details, no decisions. Decisions live in `docs/adr/`.

## Glossary

- **Ace Your Course** — the product this repository _is_.

### Surfaces

Ace Your Course is one application with three Surfaces.

- **Surface** — one of the three audience-facing areas of Ace Your Course:
  the Website, the Member App, and the Admin.

- **Website** — the public, unauthenticated Surface: the catalogue of
  Products, the Exam pages, Reviews, FAQ, About, and Legal pages. It sells
  nothing directly. It sends visitors to the Marketplaces or to the Member App.
  _Avoid_: marketing site, landing, storefront.

- **Member App** — the signed-in Surface where Members study digital content
  and buy access.
  _Avoid_: dashboard, portal, the app (when ambiguous).

- **Admin** — the staff-only Surface for managing Website content, Member App
  content, and digital sales.
  _Avoid_: dashboard, back office, CMS.

### Catalogue

- **Exam** — a Philippine licensure exam that AYC makes study material for.
  It has a code (`CE`) and a board acronym (`CELE`).
  _Avoid_: course (for a degree or program), board, program.

- **Subject** — one of an Exam's official board subjects, e.g. MSTC under CE.

- **Topic** — a unit of study within a Subject, e.g. Simple Curves under MSTC.
  Member App content is organised by Topic.

- **Product** — a physical study item sold on the Marketplaces: flash cards,
  posters, a notebook, or a bundle. Website copy may call Products "reviewers"
  for visitors. The domain term is Product.
  _Avoid_: reviewer, item, listing.

- **Coming Soon** (Product) — a Product that has been announced but is not
  out yet: no price and not for sale. It is set apart from live Products
  everywhere on the Website.
  _Avoid_: pending, TBA, new listing.

- **Marketplace** — an external store where Products are sold: Shopee,
  Lazada, or TikTok Shop.
  _Avoid_: store, shop, channel.

- **Marketplace Listing** — a Product's page on one Marketplace, e.g. its
  Shopee listing. A Product has at most one Listing per Marketplace. Without
  one, its buy button opens that Marketplace's shop page.
  _Avoid_: link, store link (as a noun for the listing itself).

- **Reviewer PDF** — a paged digital study document for one Topic, read page
  by page in the Member App. It is the only thing the domain calls a
  "Reviewer".
  _Avoid_: reviewer (unqualified), slides, notes.

- **Course** — a video course made of Modules and Lessons, e.g. PSAD
  Masterclass. Never used for an Exam.
  _Avoid_: class, program.

### Studying

- **Target Exam** — an Exam a Member is preparing for, together with their
  Exam Date. A Member may have several. Adding one is free and separate from
  buying a Plan.
  _Avoid_: enrolled exam, my exam, course.

- **Exam Date** — the day a Member sits their Target Exam. It defaults to the
  Exam's **Official Exam Date** (set by Staff from the PRC schedule) until the
  Member changes it.
  _Avoid_: board date, schedule.

- **Study Streak** — the number of consecutive Study Days. It is
  account-wide, not per Exam.

- **Study Day** — a calendar day, in Philippine time, on which a Member did any
  studying: marked a card, answered a quiz question, opened a Reviewer PDF
  page, or watched a Lesson.

- **Card Mark** — a Member's latest verdict on one flashcard: **Got it** or
  **Review again**.

- **Best Score** — a Member's highest score on a Topic's quiz. Progress is
  measured by Best Scores, never by the latest attempt.

- **Weak Topic** — a Topic where the Member's Best Score is below the quiz's
  passing score, or where 5 or more cards are marked Review again.

### Digital access

- **Plan** — what is for sale in the Member App: one Exam's All-Access for a
  fixed period at a price, e.g. "CE All-Access · 3 months · ₱1,299". A Plan
  never renews by itself.
  _Avoid_: subscription, membership, tier, package.

- **Access Pass** — a Member's right to all of one Exam's study content
  until an end date. A Member has at most one per Exam. Each Plan purchase or
  Staff grant extends it from its current end date, or from now if it has
  expired.
  _Avoid_: subscription, entitlement, license.

- **Course Ownership** — a Member's permanent right to one separately sold
  Course, independent of any Access Pass.

- **Order** — one Member's attempt to buy a Plan or a Course through
  PayMongo. It is **Pending**, **Paid**, **Failed**, **Expired** (Pending for
  more than 24 hours) or **Refunded**. Only a Paid Order grants access.
  _Avoid_: purchase, transaction, payment (for the whole record).

- **Payment Acknowledgement** — the Member App's proof of a Paid Order. It is
  not an official BIR invoice. The official invoice is issued separately by
  AYC.
  _Avoid_: receipt, invoice, official receipt.

- **Free Preview** — content that any signed-in Member can open without an
  Access Pass.
  _Avoid_: free tier, trial, sample.

### People and access

- **User** — one person's identity, a single Google account.

- **Member** — any User signed in to the Member App. Every User is a Member.
  _Avoid_: customer, subscriber, student, account.

- **Staff** — a User on the staff list, allowed into the Admin. Staff are
  invited by email before their account exists. A Staff User is also a Member.
  _Avoid_: admin (as a noun for a person), superadmin.

- **Staff Role** — a Staff User's level of Admin access: **Owner** (everything,
  including Plans and their prices, orders, Members' data, Settings and Staff
  management) or **Editor** (Website and Member App content, including Product
  prices). There is always at least one Owner.

- **Active Device** — the one device on which a Member may currently use the
  Member App. Signing in elsewhere replaces it. Admin use doesn't count.
  _Avoid_: session (for this concept), login.

- **Staff Activity** — the permanent record of every change Staff make in the
  Admin: who, what, when, and the before and after values.
  _Avoid_: audit log, history.

- **Guard** — a mechanism that permits or denies access based on whether the
  current User is Staff, and with which Staff Role. A _route Guard_ protects a
  URL; a _component Guard_ protects a region of a screen.

### Template foundations

- **Web App Template** — the reusable starter this repository was seeded from.
  Anything still named or branded "Web App Template" / "Acme" is a leftover
  placeholder meant to be renamed.

- **Reference Feature** — the one fully-worked example feature (**Customers**)
  that demonstrates every canonical pattern end to end: routing, the Service
  Seam, Server Actions, validation, a data table, and tests. New features are
  built by copying it.

- **Service Seam** — the boundary between the UI and its data source. Screens
  read and write through it and never touch a data source directly. It returns
  mock data by default; making the app real means changing the seam, not the
  screens.

- **Auth Strategy** — the pluggable authentication-provider abstraction. The
  template wires exactly one strategy (**Supabase**); the abstraction exists so
  another can be added without rewriting callers.

- **Dashboard Shell** — template term for the authenticated application frame.
  In Ace Your Course, the Member App and the Admin each have their own shell.

- **Retired template terms**: Organization, Tenant, Membership, Active
  Organization, Org Role, Platform Role and Superadmin (no tenants, see ADR
  0008), and Marketing Landing (superseded by **Website**).
