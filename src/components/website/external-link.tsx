/**
 * A link to another site. It opens in a new tab without giving that site a
 * handle on this window (`noopener noreferrer`), and tells screen reader users
 * it opens a new tab.
 */
export function ExternalLink({
  children,
  ...props
}: Omit<React.ComponentProps<"a">, "target" | "rel"> & { href: string }) {
  return (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
