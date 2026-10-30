import { paths } from "@/paths";
import type { CatalogueSeed } from "@/services/catalogue.schema";

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue seed, ported from docs/mockup/aycData.js (EXAMS, EXAM_INFO, STORES,
// CONTACT, SHOP) and the announcement in docs/mockup/website/SiteNav.dc.html.
// Only the five Exams that have Products are seeded. The client's full
// catalogue spreadsheet replaces this before launch and adds the rest of the
// Exams together with their Products. Pages never import this file: they read
// it through @/services/catalogue.
// ─────────────────────────────────────────────────────────────────────────────

const SHOPEE_SHOP = "https://shopee.ph/aceyourcourse";

export const CATALOGUE_SEED: CatalogueSeed = {
  exams: [
    {
      code: "CE",
      board: "CELE",
      name: "Civil Engineering",
      longName: "Civil Engineering Licensure Exam",
      blurb:
        "Three subjects, four formats. Our CE line started it all and it’s still our best seller. Start with the cards, add the notebook and posters, or get everything in one bundle.",
      madeFor: "Engineers needing a quick formula reference",
      subjects: [
        { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" },
        { code: "HPGE", name: "Hydraulics & Geotechnical Engineering" },
        { code: "PSAD", name: "Principles of Structural Analysis & Design" },
      ],
    },
    {
      code: "ME",
      board: "MELE",
      name: "Mechanical Engineering",
      longName: "Mechanical Engineering Licensure Exam",
      blurb:
        "Formula flash cards for all three MELE subjects on 160 gsm paper, plus a notebook for solving and posters for your wall.",
      madeFor: "Engineers needing a quick formula reference",
      subjects: [
        { code: "PIP", name: "Power & Industrial Plant Engineering" },
        { code: "MATH", name: "Mathematics" },
        { code: "MD", name: "Machine Design, Materials & Shop Practice" },
      ],
    },
    {
      code: "EE",
      board: "REE",
      name: "Electrical Engineering",
      longName: "Registered Electrical Engineer Licensure Exam",
      blurb:
        "Flash cards for every REE subject, one at a time or all three together, plus a notebook and posters.",
      madeFor: "OJT and working electrical engineers",
      subjects: [
        { code: "MATH", name: "Mathematics" },
        { code: "ESAS", name: "Engineering Sciences & Allied Subjects" },
        { code: "EE PROF", name: "Electrical Engineering Professional Subjects" },
      ],
    },
    {
      code: "MT",
      board: "MTLE",
      name: "Medical Technology",
      longName: "Medical Technologist Licensure Exam",
      blurb:
        "An A5 essential notebook, comprehensive and essentials flash cards, and essentials posters for every MTLE subject.",
      madeFor: "MedTech interns and OJT",
      subjects: [
        { code: "CLIN CHEM", name: "Clinical Chemistry" },
        { code: "HEMA", name: "Hematology" },
        { code: "CLIN MIC & PARA", name: "Clinical Microscopy & Parasitology" },
        { code: "ISBB", name: "Immunology-Serology & Blood Banking" },
        { code: "HISTOPATH", name: "Histopathologic & Cytologic Techniques" },
        { code: "MICRO", name: "Microbiology" },
      ],
    },
    {
      code: "CPA",
      board: "CPALE",
      name: "Accountancy",
      longName: "Certified Public Accountant Licensure Exam",
      blurb: "Flash cards for all six CPALE subjects, with tax content kept up to date.",
      madeFor: "Accountancy graduates and retakers",
      subjects: [
        { code: "FAR", name: "Financial Accounting & Reporting" },
        { code: "AUD", name: "Auditing" },
        { code: "AFAR", name: "Advanced Financial Accounting & Reporting" },
        { code: "TAX", name: "Taxation" },
        { code: "RFBT", name: "Regulatory Framework for Business Transactions" },
        { code: "MS", name: "Management Services" },
      ],
    },
  ],
  settings: {
    shopLinks: {
      shopee: SHOPEE_SHOP,
      lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
      tiktok: "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop",
    },
    socialLinks: {
      tiktok: "https://www.tiktok.com/@aceyourcourse",
      facebook: "https://www.facebook.com/aceyourcourseph",
      instagram: "https://www.instagram.com/aceyourcourseph",
    },
    contactEmail: "aceyourcourseinc@gmail.com",
    shopStats: { rating: 4.8, ratingCount: 874, followers: "3.7K", asOf: "2026-10-29" },
    announcement: {
      // Change the id whenever the messages change, so Visitors who dismissed
      // the old bar see the new one.
      id: "2026-10-launch",
      messages: [
        {
          text: "Physical copies on Shopee, Lazada & TikTok Shop",
          href: paths.products.list,
          requiresMemberApp: false,
        },
        {
          text: "Digital reviewers in the app · no auto-renew",
          href: paths.memberApp.home,
          requiresMemberApp: true,
        },
        {
          text: "Ships from Iloilo City · SPayLater 0% on Shopee",
          href: paths.faq,
          requiresMemberApp: false,
        },
      ],
    },
    promoBanner: {
      visible: false,
      text: "11.11 · Any 2 reviewers, 4% off on Shopee",
      buttonLabel: "Shop the sale",
      href: SHOPEE_SHOP,
      startDate: "2026-11-09",
      endDate: "2026-11-11",
    },
  },
};
