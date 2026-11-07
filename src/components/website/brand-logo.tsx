import Image from "next/image";

/**
 * The horizontal Ace Your Course logo. Pass `alt=""` where a surrounding
 * control already names it. An SVG, so it skips the image optimizer.
 */
export function BrandLogo({ alt, priority = false }: { alt: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/brand-horizontal.svg"
      alt={alt}
      width={136}
      height={29}
      priority={priority}
      unoptimized
      className="h-7.25 w-auto"
    />
  );
}
