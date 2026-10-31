# Your catalogue spreadsheet

This spreadsheet holds everything the AceYourCourse website shows about your
reviewers: the exams, each exam's subjects, the products, their variations
(the options a buyer picks on Shopee), and the reviews we show. When you send
it back, we load it into the website in one go. First we check every row and
tell you exactly what to fix, if anything.

Each file in this folder is one tab of the spreadsheet. Each has the column
names in row 1 and one example row in row 2, filled in with our Civil
Engineering flash cards.

## What to do

1. Make a Google Sheet with five tabs named **exams**, **subjects**,
   **products**, **variations** and **reviews**.
2. Paste the matching file into each tab, or copy its first row. Keep the
   column names exactly as they are. You may move columns around, but don't
   rename or delete any.
3. Replace the example row with your own rows: one row per exam, subject,
   product, variation or review.
4. Before typing dates, select the **figures_as_of** column and choose
   **Format → Number → Plain text**, so Google Sheets keeps them as you type
   them.
5. Download each tab: open the tab, then **File → Download → Comma-separated
   values (.csv)**. Rename the files exams.csv, subjects.csv, products.csv,
   variations.csv and reviews.csv.
6. Put the five files in one folder, together with a folder named
   **photos** that holds your product photos (see "Photos" below). Zip it and
   send it to us.

When we find a problem, we tell you the tab, the row number and the column,
for example: _products.csv row 7, column exam_code: unknown Exam "XX"_. The
row numbers are the ones Google Sheets shows (the column names are row 1).

## How to fill in the cells

- **Leave a cell blank** when the column says "optional" and you have nothing
  for it.
- **yes / no** columns: type yes or no. A ticked checkbox works too.
- **Lists** (several values in one cell) are separated by a **|** (the
  vertical bar), in order. For example: `MSTC|HPGE|PSAD`.
- **Prices** are in pesos, with or without the peso sign and commas: `1200`,
  `₱1,200` and `₱1,249.50` all work. At most two decimals.
- **Dates** are written year-month-day: `2026-10-29`.
- **Counts** (ratings, units sold, helpful votes) are whole numbers. Write
  `1200`, not `1.2k`.

## Tab: exams

One row per licensure exam you make reviewers for.

| Column    | What to write                                                                                                                                         | Example                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| code      | A short code of capital letters and numbers, starting with a letter. It becomes part of the exam page's web address, e.g. aceyourcourse.com/exams/ce. | CE                                          |
| board     | The board exam's acronym.                                                                                                                             | CELE                                        |
| name      | The exam's short name.                                                                                                                                | Civil Engineering                           |
| long_name | The exam's full name.                                                                                                                                 | Civil Engineering Licensure Exam            |
| blurb     | One or two sentences for the top of the exam page.                                                                                                    | Three subjects, four formats. …             |
| made_for  | Who your reviewers for this exam are for.                                                                                                             | Engineers needing a quick formula reference |

## Tab: subjects

One row per official board subject. Every exam needs at least one subject.

| Column    | What to write                                                                           | Example                                             |
| --------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| exam_code | The code of the exam it belongs to, as on the exams tab.                                | CE                                                  |
| code      | The subject's short code. Products list their subjects by this code.                    | MSTC                                                |
| name      | The subject's full name.                                                                | Mathematics, Surveying & Transportation Engineering |
| order     | Its place in the exam's list of subjects: 1 for the first, 2 for the second, and so on. | 1                                                   |

## Tab: products

One row per product. A product is either **live** (on sale) or **coming
soon** (announced, not on sale yet). A coming soon product has **no price, no
store links, no Shopee figures, no variations and no reviews**. Leave those
cells blank. Its photos are optional.

| Column           | What to write                                                                                                                                                                                                                         | Example                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| slug             | The product page's web address, in lowercase letters, numbers and hyphens: aceyourcourse.com/products/ce-formula-flash-cards. Each product's must be different. Once a product is live, don't change it, or links to it stop working. | ce-formula-flash-cards                |
| exam_code        | The code of its exam, as on the exams tab.                                                                                                                                                                                            | CE                                    |
| title            | The product's full name.                                                                                                                                                                                                              | Civil Engineering Formula Flash Cards |
| short_name       | A shorter name for cards and lists.                                                                                                                                                                                                   | CE Formula Flash Cards                |
| format           | One of: flash cards, notebook, posters, bundle.                                                                                                                                                                                       | flash cards                           |
| size             | Size and paper.                                                                                                                                                                                                                       | 4 × 6 in · 160 gsm                    |
| edition          | Optional. The edition, if it has one.                                                                                                                                                                                                 | Second Edition                        |
| subject_codes    | A list of the subjects it covers, by their codes on the subjects tab, separated by \|.                                                                                                                                                | MSTC\|HPGE\|PSAD                      |
| state            | live or coming soon.                                                                                                                                                                                                                  | live                                  |
| price_from       | The price in pesos (the lowest, if it has several). Live products only.                                                                                                                                                               | ₱1,200                                |
| price_to         | Optional. The highest price, when it is sold as a price range ("₱400 – ₱1,250").                                                                                                                                                      | ₱1,250                                |
| shopee_url       | Optional. The link to this product's own Shopee listing. Without one, the Shopee button goes to the shop page.                                                                                                                        | https://shopee.ph/…                   |
| lazada_url       | Optional. The link to its Lazada listing (a lazada.com.ph link).                                                                                                                                                                      |                                       |
| tiktok_url       | Optional. The link to its TikTok Shop listing (a tiktok.com link).                                                                                                                                                                    |                                       |
| shopee_rating    | Optional. The star rating on its Shopee listing.                                                                                                                                                                                      | 4.8                                   |
| shopee_ratings   | Optional. How many ratings it has on Shopee.                                                                                                                                                                                          | 197                                   |
| units_sold       | Optional. How many Shopee says were sold.                                                                                                                                                                                             | 764                                   |
| figures_as_of    | Optional. The day you copied those three figures from Shopee. Fill in all four Shopee figure columns, or leave all four blank.                                                                                                        | 2026-10-29                            |
| deal             | yes if the listing has Shopee's "Any 2 enjoy 4% off" deal.                                                                                                                                                                            | yes                                   |
| available_in_app | yes if its content is also in the AYC app. The website shows this only once the app has launched.                                                                                                                                     | yes                                   |
| show_on_website  | no hides the product from the website.                                                                                                                                                                                                | yes                                   |
| whats_inside     | Optional. A paragraph for the product page. Leave blank to use our standard text.                                                                                                                                                     |                                       |
| made_for         | Optional. A list of who it's for, separated by \|. Leave blank to use our standard text.                                                                                                                                              | Reviewees\|Retakers                   |
| seo_title        | Optional. The title Google shows. Leave blank to use our standard title.                                                                                                                                                              |                                       |
| seo_description  | Optional. The description Google shows. Leave blank to use our standard text.                                                                                                                                                         |                                       |
| photos           | A list of photo file names from the photos folder, separated by \|, in the order the gallery shows them. The first is the cover. A live product needs at least one.                                                                   | ce-cards-cover.jpg\|ce-cards-back.jpg |

## Tab: variations

One row per option a buyer can pick on the product's Shopee listing. Products
with no options need no rows here.

| Column       | What to write                                                  | Example                        |
| ------------ | -------------------------------------------------------------- | ------------------------------ |
| product_slug | The slug of its product, as on the products tab.               | ce-formula-flash-cards         |
| name         | The option's name, as the listing shows it.                    | FLASH CARDS: BUNDLE SECOND ED. |
| price        | Its price in pesos.                                            | ₱1,200                         |
| order        | Its place in the product's list of options: 1, 2, 3 and so on. | 1                              |

## Tab: reviews

One row per buyer review you want on the website. Copy each review **word for
word** from Shopee, with its line breaks and emoji, and don't correct it.
Reviews are shown as Shopee reviews.

| Column       | What to write                                                                                                                                                                | Example                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| product_slug | The slug of the product it's for, as on the products tab. Live products only.                                                                                                | ce-formula-flash-cards   |
| stars        | Its stars: a whole number from 1 to 5.                                                                                                                                       | 5                        |
| text         | The review, word for word. To keep a line break inside a cell in Google Sheets, press Ctrl+Enter (⌘+Enter on a Mac).                                                         | Suitability: …           |
| variation    | Optional. The option the buyer bought, as Shopee shows it under the review.                                                                                                  | MSTC, HPGE, PSAD,160 gsm |
| helpful      | Optional. How many buyers marked it helpful. Blank means 0.                                                                                                                  | 1                        |
| home_pin     | Optional. To show it on the home page, its place there: 1, 2, 3 and so on, each number used once. The home page shows the first 9. Leave blank to keep it off the home page. | 1                        |

## Photos

- Put every product photo in the **photos** folder, and list it by its file
  name in the products tab's photos column, e.g. `ce-cards-cover.jpg`.
- JPEG, PNG or WebP. Square photos look best, at least 1000 × 1000 pixels.
- We resize and compress each photo for the website, so send the best
  version you have. A photo that is too detailed to compress enough is
  reported, and we'll ask you for a smaller one.
- Use your own photos, not ones saved from a Shopee listing's page.

## Sent separately, not in this spreadsheet

- **Website settings:** your shop links, social links, contact email, the
  shop-wide Shopee rating and followers, the announcement bar and any promo
  banner.
- **FAQs:** the questions and answers on the FAQ page.
- **Sample formula cards:** the three sample cards per exam that the exam
  pages show.

Send these to us by email or in a document. We add them to the website by
hand.
