import { describe, expect, it } from "vitest";

import { getExamByCode, getWebsiteSettings, listProducts } from "@/services/catalogue";

import { testComingSoonProduct, testExam, testLiveProduct } from "../../../test/fixtures/catalogue";
import { breadcrumbJsonLd, organizationJsonLd, productJsonLd, serializeJsonLd } from "./json-ld";

const SITE = "https://aceyourcourse.ph/";
const exam = testExam();
const SHOPEE = "https://shopee.ph/CE-Formula-Flash-Cards-i.1276620555.24292303887";
const LAZADA = "https://www.lazada.com.ph/products/ce-formula-flash-cards-i1.html";

describe("productJsonLd", () => {
  it("describes the Product with its photos, brand and canonical URL", () => {
    expect(productJsonLd(testLiveProduct(), exam, SITE)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Civil Engineering Formula Flash Cards",
      url: "https://aceyourcourse.ph/products/ce-formula-flash-cards",
      image: [
        "https://aceyourcourse.ph/products/ce-formula-flash-cards/1.webp",
        "https://aceyourcourse.ph/products/ce-formula-flash-cards/2.webp",
      ],
      brand: { "@type": "Brand", name: "Ace Your Course" },
    });
  });

  it("has one Offer per Listing, priced in pesos", () => {
    const product = testLiveProduct({
      priceFrom: 124950,
      listings: { shopee: SHOPEE, lazada: LAZADA },
    });
    expect(productJsonLd(product, exam, SITE)?.offers).toEqual([
      { "@type": "Offer", url: SHOPEE, price: 1249.5, priceCurrency: "PHP" },
      { "@type": "Offer", url: LAZADA, price: 1249.5, priceCurrency: "PHP" },
    ]);
  });

  it("has an AggregateOffer over the Listings when priced as a range", () => {
    const product = testLiveProduct({
      priceFrom: 40000,
      priceTo: 125000,
      listings: { shopee: SHOPEE },
    });
    expect(productJsonLd(product, exam, SITE)?.offers).toEqual({
      "@type": "AggregateOffer",
      lowPrice: 400,
      highPrice: 1250,
      priceCurrency: "PHP",
      offerCount: 1,
      offers: [{ "@type": "Offer", url: SHOPEE }],
    });
  });

  it("never turns a shop-page fallback into an Offer", () => {
    expect(productJsonLd(testLiveProduct({ listings: {} }), exam, SITE)).not.toHaveProperty(
      "offers",
    );
  });

  it("is null for a Coming Soon Product", () => {
    expect(productJsonLd(testComingSoonProduct(), exam, SITE)).toBeNull();
  });

  it("never has rating or review markup, for any Product in the catalogue", async () => {
    const products = [
      ...(await listProducts()).items,
      ...(await listProducts({ state: "coming-soon" })).items,
    ];
    expect(products).toHaveLength(15);
    for (const product of products) {
      const productExam = await getExamByCode(product.examCode);
      if (!productExam) throw new Error(`no Exam for ${product.slug}`);
      const json = JSON.stringify(productJsonLd(product, productExam, SITE));
      expect(json).not.toMatch(/aggregateRating/i);
      expect(json).not.toMatch(/"review/i);
    }
  });
});

describe("breadcrumbJsonLd", () => {
  it("lists each crumb in order with an absolute URL", () => {
    expect(
      breadcrumbJsonLd(
        [
          { name: "Products", path: "/products" },
          { name: "CELE", path: "/exams/ce" },
          { name: "CE Formula Flash Cards", path: "/products/ce-formula-flash-cards" },
        ],
        SITE,
      ),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Products",
          item: "https://aceyourcourse.ph/products",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "CELE",
          item: "https://aceyourcourse.ph/exams/ce",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "CE Formula Flash Cards",
          item: "https://aceyourcourse.ph/products/ce-formula-flash-cards",
        },
      ],
    });
  });
});

describe("organizationJsonLd", () => {
  it("names AYC with its URL, logo, contact email and every shop and social link", async () => {
    expect(organizationJsonLd(await getWebsiteSettings(), SITE)).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Ace Your Course",
      url: "https://aceyourcourse.ph/",
      logo: "https://aceyourcourse.ph/icon",
      email: "aceyourcourseinc@gmail.com",
      sameAs: [
        "https://shopee.ph/aceyourcourse",
        "https://www.lazada.com.ph/shop/aceyourcourse",
        "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop",
        "https://www.tiktok.com/@aceyourcourse",
        "https://www.facebook.com/aceyourcourseph",
        "https://www.instagram.com/aceyourcourseph",
      ],
    });
  });

  it("drops a hidden shop or social link from sameAs", async () => {
    const settings = await getWebsiteSettings();
    const { sameAs } = organizationJsonLd(
      {
        ...settings,
        shopLinks: { ...settings.shopLinks, lazada: null },
        socialLinks: { ...settings.socialLinks, instagram: null },
      },
      SITE,
    );
    expect(sameAs).toEqual([
      "https://shopee.ph/aceyourcourse",
      "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop",
      "https://www.tiktok.com/@aceyourcourse",
      "https://www.facebook.com/aceyourcourseph",
    ]);
  });

  it("leaves sameAs out, rather than empty, when every link is hidden", async () => {
    const settings = await getWebsiteSettings();
    expect(
      organizationJsonLd(
        {
          ...settings,
          shopLinks: { shopee: null, lazada: null, tiktok: null },
          socialLinks: { tiktok: null, facebook: null, instagram: null },
        },
        SITE,
      ),
    ).not.toHaveProperty("sameAs");
  });

  it("is on the site URL with or without a trailing slash", async () => {
    const settings = await getWebsiteSettings();
    expect(organizationJsonLd(settings, "https://www.example.ph")).toMatchObject({
      url: "https://www.example.ph/",
      logo: "https://www.example.ph/icon",
    });
  });
});

describe("serializeJsonLd", () => {
  it("escapes < so a title can never close the script tag", () => {
    const product = testLiveProduct({ title: 'Cards</script><script>alert("x")</script>' });
    const json = serializeJsonLd(productJsonLd(product, exam, SITE) ?? {});
    expect(json).not.toContain("</script>");
    expect(json).not.toContain("<");
    expect(json).toContain("\\u003c/script>");
    expect(JSON.parse(json)).toMatchObject({ name: product.title });
  });
});
