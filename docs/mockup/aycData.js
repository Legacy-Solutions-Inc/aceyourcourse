const IMG = 'https://down-ph.img.susercontent.com/file/';
const peso = n => '₱' + Number(n).toLocaleString('en-PH');

export const SHOP = {
  rating: 4.8, ratings: 874, followers: '3.7K', origin: 'Iloilo City, Iloilo',
  url: 'https://shopee.ph/aceyourcourse',
  tagline: 'Built by board passers. Designed for dreamers.'
};

export const STORES = { shopee: 'https://shopee.ph/aceyourcourse', lazada: 'https://www.lazada.com.ph/shop/aceyourcourse', tiktok: 'https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop' };
const DIGITAL = ['24292303887','43951361927','47253400621','29289640595','43780215950'];

export const SUBJECT_NAMES = {
  MSTC: 'Mathematics, Surveying & Transportation Engineering',
  HPGE: 'Hydraulics & Geotechnical Engineering',
  PSAD: 'Principles of Structural Analysis & Design'
};

const raw = [
  { id: '24292303887', exam: 'CE', board: 'CELE', short: 'CE Formula Flash Cards', title: 'Civil Engineering Formula Flash Cards', format: 'Flash cards', size: '4 × 6 in · 160 gsm', edition: 'Second Edition',
    url: 'https://shopee.ph/Civil-Engineering-Formula-Flash-Cards-(CELE-Board-Exam-School-Reviewer)-i.1276620555.24292303887',
    price: 1200, priceMax: null, rating: 4.8, ratingCount: 197, sold: 764, subjects: ['MSTC', 'HPGE', 'PSAD'], deal: true,
    images: ['ph-11134207-820l8-mmtzp3nzi1oi05','ph-11134207-820l5-mmtzp3opokqu5c','ph-11134207-820lc-mmtzp3oqw2rme4','ph-11134207-820l5-mmtzp3ozv5dvb1','ph-11134207-820lc-mmtzp3q1po8x47','ph-11134207-820lh-mmtzp3pwn2f904','ph-11134207-820lf-mmtzp3r5ct8g7d','ph-11134207-820lg-mmtzp3raz30m56'],
    variations: [{ name: 'FLASH CARDS: BUNDLE SECOND ED.', price: 1200, inStock: true }],
    reviews: [
      { stars: 5, text: 'fast delivery, perfect also as a gift. print is high quality, font sizes are readable, handy rin sya. super satisfied with this purchase, no complains at all', variation: 'MSTC, HPGE, PSAD,160 gsm', helpful: 8 },
      { stars: 5, text: 'hiii kaka receive ko lang sa order ko, I supeeer like iiit huwaaah, saktong dating kasi bukas ay mag Mock Board Exam kami kaya imma review it naaa. 🤭🥰 thank you pooo, ni recommend ko ito sa mga classmates at juniors ko, gusto ko rin na may ganito sila para makatulong rin at makapasa rin silaaa. Goodluck Engineers! 🫶🏻', variation: null, helpful: 5 },
      { stars: 5, text: "Readability: The layout is clearly minimalist, easy to understand, and perfect for quick study sessions.\nUsefulness: Highly recommended! A great investment and a must have for Civil Engineering students, reviewees/aspiring engineers!\nAbsolutely worth it! 💯 These Civil Engineering Formula Cards make studying much more efficient. They contain essential formulas that are frequently used in engineering subjects and board exam reviews.\nThese formula cards have become one of my go to review materials because they help me quickly recall important concepts and equations. They make studying more organized, convenient, and effective. With resources like this, I feel more confident and motivated in my preparation, and I'm looking forward to becoming a Registered Civil Engineer (RCE) soonest! 🩵👷🏼‍♀️🏗️ #RCE2026 #CivilEngineering #BoardExamPreparation", variation: 'BUNDLE SECOND ED.', helpful: 1 },
      { stars: 5, text: "Suitability: The flashcards are very useful\nQuality: It's clear and easy to read.\nIt's also packaged nicely.", variation: 'MSTC, HPGE, PSAD,160 gsm', helpful: 1 },
      { stars: 5, text: 'Easy to use, handy/convenient and the font size is perfect for reading/memorizing, recommendable', variation: null, helpful: 0 }
    ] },
  { id: '43951361927', exam: 'ME', board: 'MELE', short: 'ME Formula Flash Cards', title: 'Mechanical Engineering Formula Flash Cards', format: 'Flash cards', size: '4 × 6 in · 160 gsm', edition: null,
    url: 'https://shopee.ph/Mechanical-Engineering-Formula-Flash-Cards-(MELE-Board-Exam-School-Reviewer)-i.1276620555.43951361927',
    price: 950, priceMax: null, rating: 4.8, ratingCount: 95, sold: 404, subjects: ['Power & Industrial Plant', 'Mathematics', 'Machine Design'], deal: true,
    images: ['ph-11134207-7ras9-m9xn4kefzncza2','ph-11134207-7rasj-m9xn4kezyu4ja1','ph-11134207-7rasa-m9xn4kdw0gmrfa'],
    variations: [{ name: 'FLASH CARDS: BUNDLE / PAPER TYPE: 160 gsm', price: 950, inStock: true }],
    reviews: [
      { stars: 5, text: 'Suitability: Good\nSafe yung item na dumating dito sa bahay nawa ay maging top notcher in the future AHAHAH because tonight will bee the morning', variation: 'BUNDLE,160 gsm', helpful: 10 },
      { stars: 5, text: 'All of the essential and fundamental formulas are here, it’s very helpful for my review.', variation: 'BUNDLE,160 gsm', helpful: 7 },
      { stars: 5, text: 'Oks naman, minor thoughts lang sana same ang font sizes para di nakaka ocd', variation: 'BUNDLE,160 gsm', helpful: 0 }
    ] },
  { id: '47253400621', exam: 'CPA', board: 'CPALE', short: 'CPA Flash Cards', title: 'Certified Public Accountant (CPA) Flash Cards', format: 'Flash cards', size: '4 × 6 in', edition: null,
    url: 'https://shopee.ph/Certified-Public-Accountant-(CPA)-Flash-Cards-CPALE-Board-Exam-School-Reviewer-i.1276620555.47253400621',
    price: 1150, priceMax: null, rating: 4.8, ratingCount: 56, sold: 273, subjects: ['FAR', 'AUD THEORY', 'AFAR', 'TAX', 'RFBT', 'MS'], deal: true,
    images: ['ph-11134207-81ztc-mihe8gv26uwxa1','ph-11134207-81ztp-mihe8gvdi7m067'],
    variations: [],
    reviews: [
      { stars: 5, text: 'Thank you po! Maganda po lahat ng subs, worth it and updated din po yung tax', variation: null, helpful: 0 },
      { stars: 5, text: "Suitability: Very suitable!\nI haven't really read it but as I scan, I loved it. The text is not too small. It is understandable enough. It is good for recalling. Hoping that this could really help me reach my goal. 🙏", variation: null, helpful: 4 }
    ] },
  { id: '29289640595', exam: 'EE', board: 'REE', short: 'EE Flash Cards', title: 'Electrical Engineering Flash Cards', format: 'Flash cards', size: '4 × 6 in · 160 gsm', edition: null,
    url: 'https://shopee.ph/Electrical-Engineering-Flash-Cards-(REE-Board-Exam-School-Reviewer-OJT-EE-Work)-i.1276620555.29289640595',
    price: 600, priceMax: 1550, rating: 4.8, ratingCount: 73, sold: 240, subjects: ['MATH', 'ESAS', 'EE PROF. SUB.'], deal: true,
    images: ['ph-11134207-7ra0n-md69811mn4z5fb','ph-11134207-7ra0k-md69811wlb88e1'],
    variations: [],
    reviews: [
      { stars: 5, text: 'Flash Cards: goods yung flash card andito na halos yung mga formula\nMemorization: marerecommend ko to sa nahihirapan mag memorize', variation: 'BUNDLE,160 gsm', helpful: 1 },
      { stars: 5, text: 'Learning: Makes it easier to memorize and familiarize formulas.\nBoard Exam: Another weapon for my upcoming board examination.\nSeller is very responsive. Thank you very much!!', variation: 'BUNDLE,160 gsm', helpful: 0 }
    ] },
  { id: '27980584601', exam: 'CE', board: 'CELE', short: 'Ultimate CE Posters 2.0', title: 'Ultimate Civil Engineering Posters', format: 'Posters', size: 'A3', edition: '2.0',
    url: 'https://shopee.ph/Ultimate-Civil-Engineering-Posters-(CELE-Board-Exam-School-Reviewer)-i.1276620555.27980584601',
    price: 400, priceMax: 1250, rating: 4.9, ratingCount: 52, sold: 172, subjects: ['MSTC', 'HPGE', 'PSAD'], deal: true,
    images: ['ph-11134207-820lg-mnau18k2o4qw35','ph-11134207-820le-mnau18km3nk0a4'],
    variations: [
      { name: 'CE POSTERS 2.0: MSTC, HPGE, PSAD', price: 1250, inStock: true },
      { name: 'CE POSTERS 2.0: MSTC ONLY', price: 400, inStock: true },
      { name: 'CE POSTERS 2.0: HPGE ONLY', price: 470, inStock: true },
      { name: 'CE POSTERS 2.0: PSAD ONLY', price: 700, inStock: true }
    ],
    reviews: [
      { stars: 5, text: 'Perfect quality for Engineering students, fresh grads and retakers readying for board exam', variation: 'MSTC, HPGE, PSAD', helpful: 19 },
      { stars: 5, text: 'Glossy type yung paper, makapal sya. Malalaki printing ng formulas kaya mababasa mo mga 6ft away hahaha. Quality 10/10.', variation: 'MSTC, HPGE, PSAD', helpful: 0 },
      { stars: 5, text: 'Thank you nang marami seller, diko na kuha ang first item na binili ko pero na redeliver agad.. very responsive si seller and approachable. Super LEGIT 👌❤️.', variation: 'MSTC, HPGE, PSAD', helpful: 0 }
    ] },
  { id: '28792067103', exam: 'MT', board: 'MTLE', short: 'MedTech Essential Notebook', title: 'Medical Technology Essential Notebook', format: 'Notebook', size: 'A5', edition: null,
    url: 'https://shopee.ph/Medical-Technology-Essential-Notebook-(MTLE-Board-Exam-School-Reviewer-OJT-MedTech-Work)-i.1276620555.28792067103',
    price: 699, priceMax: null, rating: 4.3, ratingCount: 29, sold: 96, subjects: ['Clin Chem', 'Hema', 'Clin Mic', 'ISBB', 'HTMLBE', 'Micro & Para'], deal: true,
    images: ['ph-11134207-81ztg-mf13d7lk4nijb6','ph-11134207-81ztd-mf13d7lm8i6gd1'],
    variations: [],
    reviews: [
      { stars: 3, text: 'Useful for memorizing information, but contains too many formulas and could include more basic concepts, especially in Clinical Chemistry, Hematology, and Microbiology. There are also many blank pages that could have been used for additional content.', variation: null, helpful: 0 }
    ] },
  { id: '43780215950', exam: 'MT', board: 'MTLE', short: 'MedTech Comprehensive Flash Cards', title: 'Medical Technology Comprehensive Flash Cards', format: 'Flash cards', size: '4 × 6 in', edition: 'Modules 1–6',
    url: 'https://shopee.ph/Medical-Technology-Comprehensive-Flash-Cards-MTLE-Board-Exam-School-Reviewer-i.1276620555.43780215950',
    price: 550, priceMax: 2750, rating: 5, ratingCount: 6, sold: 18, subjects: ['Clin Chem', 'Hema 1&2', 'ClinMic & Para', 'ISBB', 'Histopath', 'Micro'], deal: true,
    images: ['ph-11134207-820lg-mn9pk2a2bj7o45'], variations: [], reviews: [] },
  { id: '55314794259', exam: 'CE', board: 'CELE', short: 'CE Review Bundle 3-in-1', title: 'Civil Engineering Review Bundle 3-in-1', format: 'Bundle', size: 'Flash cards + notebook + A3 posters', edition: '2.0',
    url: 'https://shopee.ph/Civil-Engineering-Review-Bundle-3-in-1-CE-Flash-Cards-Posters-Notebook-MSTC-HPGE-PSAD-CELE-i.1276620555.55314794259',
    price: 1200, priceMax: 3499, rating: 4.5, ratingCount: 6, sold: 16, subjects: ['MSTC', 'HPGE', 'PSAD'], deal: false,
    images: ['ph-11134207-820l7-mr2dcuca09382e','ph-11134207-820l9-mr2cfpp56eisa4'],
    variations: [
      { name: 'REVIEW BUNDLE: CE FLASH CARDS 2.0', price: 1200, inStock: true },
      { name: 'REVIEW BUNDLE: CE NOTEBOOK 2.0', price: 1249, inStock: true },
      { name: 'REVIEW BUNDLE: CE POSTERS 2.0', price: 1250, inStock: true },
      { name: 'REVIEW BUNDLE: 3-IN-1 FC|NB|POS 2.0', price: 3499, inStock: true }
    ], reviews: [] }
];


const PENDING = [
  ['p-ce-notebook', 'CE', 'CELE', 'CE Solving Notebook', 'Civil Engineering Solving Notebook', 'Notebook', 'A5', ['MSTC', 'HPGE', 'PSAD']],
  ['p-me-notebook', 'ME', 'MELE', 'ME Notebook', 'Mechanical Engineering Notebook', 'Notebook', 'A5', ['Power & Industrial Plant', 'Mathematics', 'Machine Design']],
  ['p-me-posters', 'ME', 'MELE', 'ME Posters', 'Mechanical Engineering Posters', 'Posters', 'A3', ['Power & Industrial Plant', 'Mathematics', 'Machine Design']],
  ['p-ee-notebook', 'EE', 'REE', 'EE Notebook', 'Electrical Engineering Notebook', 'Notebook', 'A5', ['MATH', 'ESAS', 'EE PROF. SUB.']],
  ['p-ee-posters', 'EE', 'REE', 'EE Posters', 'Electrical Engineering Posters', 'Posters', 'A3', ['MATH', 'ESAS', 'EE PROF. SUB.']],
  ['p-mt-ess-cards', 'MT', 'MTLE', 'MedTech Essentials Flash Cards', 'Medical Technology Essentials Flash Cards', 'Flash cards', '4 × 6 in', ['Clin Chem', 'Hema', 'Clin Mic', 'ISBB', 'Histopath', 'Micro']],
  ['p-mt-ess-posters', 'MT', 'MTLE', 'MedTech Essentials Posters', 'Medical Technology Essentials Posters', 'Posters', 'A3', ['Clin Chem', 'Hema', 'Clin Mic', 'ISBB', 'Histopath', 'Micro']]
].map(([id, exam, board, short, title, format, size, subjects]) => ({ id, exam, board, short, title, format, size, edition: null, url: 'https://shopee.ph/aceyourcourse',
  price: 0, priceMax: null, rating: 0, ratingCount: 0, sold: 0, subjects, deal: false, pending: true, images: [], variations: [], reviews: [] }));
const PH_IMG = 'assets/product-photo-soon.svg';

export const PRODUCTS = [...raw, ...PENDING].map(p => ({
  ...p,
  images: p.pending ? [PH_IMG] : p.images.map(i => IMG + i),
  digital: DIGITAL.includes(p.id),
  href: 'Product.dc.html?id=' + p.id,
  target: '_self',
  img: p.pending ? PH_IMG : IMG + p.images[0],
  priceLabel: p.pending ? 'Price TBA' : p.priceMax ? 'from ' + peso(p.price) : peso(p.price),
  soldLabel: p.pending ? 'New listing' : p.sold.toLocaleString('en-PH') + ' sold',
  ratingLabel: p.pending ? 'New' : p.rating.toFixed(1),
  subjectsLine: p.subjects.join(' · '),
  reviews: p.reviews.map(r => ({ ...r, product: p.short, exam: p.exam }))
}));

export const byId = id => PRODUCTS.find(p => p.id === id);
export const bySold = () => [...PRODUCTS].sort((a, b) => b.sold - a.sold);
export const CONTACT = { email: 'aceyourcourseinc@gmail.com', facebook: 'https://www.facebook.com/aceyourcourseph', instagram: 'https://www.instagram.com/aceyourcourseph' };

export const EXAMS = [
  { code: 'CE', board: 'CELE', name: 'Civil Engineering' },
  { code: 'ME', board: 'MELE', name: 'Mechanical Engineering' },
  { code: 'EE', board: 'REE', name: 'Electrical Engineering' },
  { code: 'MT', board: 'MTLE', name: 'Medical Technology' },
  { code: 'CPA', board: 'CPALE', name: 'Accountancy' },
  { code: 'PH', board: 'PhLE', name: 'Pharmacy', soon: true },
  { code: 'LET', board: 'LET', name: 'Teachers', soon: true },
  { code: 'FT', board: 'FTLE', name: 'Fisheries', soon: true },
  { code: 'MP', board: 'MPLE', name: 'Master Plumber', soon: true },
  { code: 'PT', board: 'PTLE', name: 'Physical Therapy', soon: true },
  { code: 'PM', board: 'PmLE', name: 'Psychometrician', soon: true }
].map((e, i) => {
  const ps = PRODUCTS.filter(p => p.exam === e.code);
  const priced = ps.filter(p => !p.pending), min = priced.length ? Math.min(...priced.map(p => p.price)) : null;
  return { ...e, href: e.soon ? '#' : 'Exam.dc.html?exam=' + e.code, tabX: ((i * 37) % 5) * 14 + 'px', count: ps.length,
    meta: e.soon ? 'On Shopee now · on the site soon' : ps.length + (ps.length === 1 ? ' reviewer' : ' reviewers') + ' · from ' + peso(min) };
});

export const stars = n => ({ on: '★'.repeat(n), off: '★'.repeat(5 - n) });
export { peso };

export const EXAM_INFO = {
  CE: { name: 'Civil Engineering', long: 'Civil Engineering Licensure Exam', for3: 'Engineers needing a quick formula reference',
    blurb: 'Three subjects, four formats. Our CE line started it all and it’s still our best seller. Start with the cards, add the notebook and posters, or get everything in one bundle.',
    subjects: [['MSTC','Mathematics, Surveying & Transportation Engineering'],['HPGE','Hydraulics & Geotechnical Engineering'],['PSAD','Principles of Structural Analysis & Design']] },
  ME: { name: 'Mechanical Engineering', long: 'Mechanical Engineering Licensure Exam', for3: 'Engineers needing a quick formula reference',
    blurb: 'Formula flash cards for all three MELE subjects on 160 gsm paper, plus a notebook for solving and posters for your wall.',
    subjects: [['PIP','Power & Industrial Plant Engineering'],['MATH','Mathematics'],['MD','Machine Design, Materials & Shop Practice']] },
  EE: { name: 'Electrical Engineering', long: 'Registered Electrical Engineer Licensure Exam', for3: 'OJT and working electrical engineers',
    blurb: 'Flash cards for every REE subject, one at a time or all three together, plus a notebook and posters.',
    subjects: [['MATH','Mathematics'],['ESAS','Engineering Sciences & Allied Subjects'],['EE PROF','Electrical Engineering Professional Subjects']] },
  MT: { name: 'Medical Technology', long: 'Medical Technologist Licensure Exam', for3: 'MedTech interns and OJT',
    blurb: 'An A5 essential notebook, comprehensive and essentials flash cards, and essentials posters for every MTLE subject.',
    subjects: [['CLIN CHEM','Clinical Chemistry'],['HEMA','Hematology'],['CLIN MIC & PARA','Clinical Microscopy & Parasitology'],['ISBB','Immunology-Serology & Blood Banking'],['HISTOPATH','Histopathologic & Cytologic Techniques'],['MICRO','Microbiology']] },
  CPA: { name: 'Accountancy', long: 'Certified Public Accountant Licensure Exam', for3: 'Accountancy graduates and retakers',
    blurb: 'Flash cards for all six CPALE subjects, with tax content kept up to date.',
    subjects: [['FAR','Financial Accounting & Reporting'],['AUD','Auditing'],['AFAR','Advanced Financial Accounting & Reporting'],['TAX','Taxation'],['RFBT','Regulatory Framework for Business Transactions'],['MS','Management Services']] }
};
