import Image from "next/image";

import { cn } from "@/lib/utils";
import type { ProductPhoto } from "@/services/catalogue.types";

/** Shown for a Product with no photos, such as a Coming Soon Product. */
export const PLACEHOLDER_PHOTO = "/products/coming-soon.svg";

interface ProductImageProps {
  /** Null shows the placeholder. */
  photo: ProductPhoto | null;
  /** Overrides the photo's own alt text, e.g. "" where the image is decorative. */
  alt?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}

/**
 * A self-hosted Product photo filling its (relatively positioned) box, served
 * through the image optimizer. The placeholder SVG is served as is.
 */
export function ProductImage({
  photo,
  alt,
  sizes,
  priority = false,
  className,
}: ProductImageProps) {
  return (
    <Image
      src={photo?.src ?? PLACEHOLDER_PHOTO}
      alt={alt ?? photo?.alt ?? ""}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={!photo}
      className={cn("object-cover", className)}
    />
  );
}
