import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ProductGallery } from "./product-gallery";

const PHOTOS = [1, 2, 3].map((n) => ({
  src: `/products/ce-formula-flash-cards/${n}.webp`,
  alt: `Civil Engineering Formula Flash Cards, photo ${n} of 3`,
}));

const mainPhoto = () => screen.getByTestId("gallery-main").querySelector("img");

describe("ProductGallery", () => {
  it("shows the cover first with an i / N counter", () => {
    render(<ProductGallery photos={PHOTOS} />);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(mainPhoto()).toHaveAttribute("alt", PHOTOS[0]?.alt);
  });

  it("switches photos from the thumbnails", async () => {
    const user = userEvent.setup();
    render(<ProductGallery photos={PHOTOS} />);
    await user.click(screen.getByRole("button", { name: "Show photo 3 of 3" }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(mainPhoto()).toHaveAttribute("alt", PHOTOS[2]?.alt);
    expect(screen.getByRole("button", { name: "Show photo 3 of 3" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("moves between photos with the arrow keys, wrapping round", async () => {
    const user = userEvent.setup();
    render(<ProductGallery photos={PHOTOS} />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Show photo 1 of 3" })).toHaveFocus();

    await user.keyboard("[ArrowRight]");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show photo 2 of 3" })).toHaveFocus();

    await user.keyboard("[ArrowLeft][ArrowLeft]");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    await user.keyboard("[Home]");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    await user.keyboard("[End]");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  it("has no thumbnails for a single photo", () => {
    render(<ProductGallery photos={PHOTOS.slice(0, 1)} />);
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the placeholder, with no counter, when there are no photos", () => {
    render(<ProductGallery photos={[]} />);
    expect(mainPhoto()).toHaveAttribute("src", "/products/coming-soon.svg");
    expect(screen.queryByText(/\d \/ \d/)).not.toBeInTheDocument();
  });
});
