import { redirect } from "next/navigation";

import { paths } from "@/paths";

// /legal has no page of its own: it opens the Privacy Policy.
export default function LegalIndexPage() {
  redirect(paths.legal.privacy);
}
