import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ProductCard } from "@/components/website/product-card";
import { websiteCopy } from "@/content/website";
import type { StaffActor } from "@/services/admin.types";
import { getProductBySlug } from "@/services/catalogue";
import { setProductFlags } from "@/services/mock/admin/products";
import { resetSampleStore } from "@/services/mock/sample-store";

// The App toggle reaches the Website: once a Product is available in the app,
// its card shows BADGE while the Member App switch is on, and nothing
// while it's off.
const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};
const POSTERS = "ultimate-ce-posters-2-0";
/** The card's app badge: "In app". */
const BADGE = websiteCopy.product.app.cardBadge;

async function postersOnTheWebsite() {
  const product = await getProductBySlug(POSTERS);
  if (!product) throw new Error("the posters aren't on the Website");
  return product;
}

describe("the App toggle on the Website", () => {
  beforeEach(() => {
    resetSampleStore();
  });

  it("shows the app badge on the card once turned on, while the Member App switch is on", async () => {
    render(<ProductCard product={await postersOnTheWebsite()} memberAppLive />);
    expect(screen.queryByText(BADGE)).toBeNull();

    await setProductFlags(EDITOR, "prd-005", { availableInApp: true });
    render(<ProductCard product={await postersOnTheWebsite()} memberAppLive />);

    expect(screen.getByText(BADGE)).toBeInTheDocument();
  });

  it("changes nothing on the card while the Member App switch is off", async () => {
    await setProductFlags(EDITOR, "prd-005", { availableInApp: true });
    render(<ProductCard product={await postersOnTheWebsite()} memberAppLive={false} />);

    expect(screen.queryByText(BADGE)).toBeNull();
  });
});
