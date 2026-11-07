import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { testComingSoonProduct, testLiveProduct } from "../../../test/fixtures/catalogue";
import { ProductAppBand } from "./product-app-band";

describe("ProductAppBand", () => {
  it("offers the Exam's All-Access plans for a Product in the app, while the switch is on", () => {
    render(<ProductAppBand product={testLiveProduct({ availableInApp: true })} memberAppLive />);
    expect(screen.getByText(/also available in the app/i)).toBeInTheDocument();
    expect(screen.getByText(/Included in CE All-Access\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see plans/i })).toHaveAttribute("href", "/app/plans");
  });

  it('says "Printed only" for a Product not in the app, while the switch is on', () => {
    render(<ProductAppBand product={testLiveProduct({ availableInApp: false })} memberAppLive />);
    expect(screen.getByText(/printed only · not available in the app/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it.each([true, false])(
    "shows nothing while the switch is off (available in app: %s)",
    (availableInApp) => {
      const { container } = render(
        <ProductAppBand product={testLiveProduct({ availableInApp })} memberAppLive={false} />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("shows nothing for a Coming Soon Product", () => {
    const { container } = render(
      <ProductAppBand product={testComingSoonProduct()} memberAppLive />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
