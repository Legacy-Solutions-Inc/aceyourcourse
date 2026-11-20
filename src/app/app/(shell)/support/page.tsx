import type { Metadata } from "next";

import { MemberScreen } from "@/components/member-app/member-screen";
import { SupportScreen } from "@/components/member-app/support-screen";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { paths } from "@/paths";
import { getWebsiteSettings } from "@/services/catalogue";
import { supportCopy } from "@/content/member-app/support";

export const metadata: Metadata = { title: "Support" };

/**
 * Support (mockup L479–492; story 113): the contact email from Settings, to
 * email, and the common questions. The gate runs first, like every screen in
 * the shell.
 */
export default async function SupportPage() {
  await requireMemberWithExam(paths.memberApp.support);
  const { contactEmail } = await getWebsiteSettings();
  return (
    <MemberScreen eyebrow={supportCopy.eyebrow} title={supportCopy.title}>
      <SupportScreen contactEmail={contactEmail} />
    </MemberScreen>
  );
}
