import { pesoText } from "@/lib/admin/peso";
import { variationLabel } from "@/lib/catalogue/price";
import {
  productMadeFor,
  productSeoDescription,
  productSeoTitle,
  productWhatsInside,
} from "@/lib/catalogue/product-copy";
import type { NewProductForm, ProductForm } from "@/services/admin.schema";
import type { Exam, Product } from "@/services/catalogue.types";

// The Product editor's values (BUILD-MAP §3.3, Editor panel): a Product's
// fields as its form holds them, and back through the seam's schema
// (admin.schema.ts). Prices are written in pesos, "Made for" one per line.

const figureText = (value: number | undefined) => (value === undefined ? "" : String(value));

/** Pure: a Product's fields as its editor opens them. */
export function productFormValues(product: Product): ProductForm {
  return {
    title: product.title,
    shortName: product.shortName,
    edition: product.edition ?? "",
    examCode: product.examCode,
    format: product.format,
    size: product.size,
    subjectCodes: [...product.subjectCodes],
    comingSoon: product.state === "coming-soon",
    deal: product.deal,
    priceFrom: pesoText(product.priceFrom),
    priceTo: pesoText(product.priceTo),
    variations: product.variations.map((variation) => ({
      name: variation.name,
      price: pesoText(variation.price),
    })),
    shopee: {
      rating: figureText(product.shopee?.rating),
      ratingCount: figureText(product.shopee?.ratingCount),
      unitsSold: figureText(product.shopee?.unitsSold),
    },
    whatsInside: product.whatsInside ?? "",
    madeFor: product.madeFor?.join("\n") ?? "",
    listings: {
      shopee: product.listings.shopee ?? "",
      lazada: product.listings.lazada ?? "",
      tiktok: product.listings.tiktok ?? "",
    },
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
  };
}

/** Pure: a new Product's form: blank, for this Exam, Live, on the website and not in the app. */
export function newProductForm(examCode: string): NewProductForm {
  return {
    title: "",
    shortName: "",
    edition: "",
    examCode,
    format: "flash-cards",
    size: "",
    subjectCodes: [],
    comingSoon: false,
    deal: false,
    priceFrom: "",
    priceTo: "",
    variations: [],
    shopee: { rating: "", ratingCount: "", unitsSold: "" },
    whatsInside: "",
    madeFor: "",
    listings: { shopee: "", lazada: "", tiktok: "" },
    seoTitle: "",
    seoDescription: "",
    showOnWebsite: true,
    availableInApp: false,
  };
}

/** Pure: the chosen Subjects still on this Exam, after the Exam is changed. */
export function subjectsOnExam(codes: string[], exam: Exam | undefined): string[] {
  return codes.filter((code) => exam?.subjects.some((subject) => subject.code === code));
}

/**
 * Pure: the text the Website generates for this form's Product as it stands,
 * shown as each blank field's placeholder (spec, Phase 2 → Products: "Blank
 * uses the generated text"). Null without an Exam.
 */
export function generatedProductCopy(form: ProductForm, exam: Exam | undefined) {
  if (!exam) return null;
  const product: Product = {
    id: "",
    slug: "",
    examCode: exam.code,
    title: form.title.trim(),
    shortName: form.shortName.trim(),
    format: form.format,
    size: form.size,
    edition: null,
    subjectCodes: form.subjectCodes,
    state: form.comingSoon ? "coming-soon" : "live",
    priceFrom: null,
    priceTo: null,
    variations: [],
    photos: [],
    listings: {},
    shopee: null,
    deal: form.deal,
    availableInApp: false,
    showOnWebsite: true,
    whatsInside: null,
    madeFor: null,
    seoTitle: null,
    seoDescription: null,
  };
  return {
    whatsInside: productWhatsInside(product, exam),
    madeFor: productMadeFor(product, exam),
    seoTitle: productSeoTitle(product, exam),
    seoDescription: productSeoDescription(product, exam),
  };
}

/**
 * Pure: a variation renamed from the editor, which shows its name without the
 * Marketplace's "CE POSTERS 2.0:" prefix (mockup 1095). The prefix is kept.
 */
export function renameVariation(name: string, label: string): string {
  return `${name.slice(0, name.length - variationLabel(name).length)}${label}`;
}
