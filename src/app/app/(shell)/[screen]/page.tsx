import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { memberScreen } from "@/components/member-app/member-menu";
import { MemberScreen } from "@/components/member-app/member-screen";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { paths } from "@/paths";

interface ComingSoonPageProps {
  params: Promise<{ screen: string }>;
}

export async function generateMetadata({ params }: ComingSoonPageProps): Promise<Metadata> {
  return { title: memberScreen((await params).screen)?.label ?? "Not found" };
}

/**
 * The menu's screens that aren't built yet (Courses): each says it's
 * coming in the beta. A later ticket's own folder takes its address over from
 * this one, as Plans and Billing did (Phase 4, tickets 02 and 06). The gate runs first, so
 * someone it doesn't let in learns nothing about which addresses exist, and a
 * Member who is still onboarding goes to Home to pick their Exam.
 */
export default async function ComingSoonPage({ params }: ComingSoonPageProps) {
  const { screen: segment } = await params;
  await requireMemberWithExam(`${paths.memberApp.home}/${segment}`);
  const screen = memberScreen(segment);
  if (!screen) notFound();

  return (
    <MemberScreen
      eyebrow={`${screen.code} · ${screen.label.toUpperCase()}`}
      title="Coming in the beta"
    >
      <p className="max-w-prose text-base leading-normal">
        {screen.label} isn’t ready yet. It’s where you’ll find: {screen.hint.toLowerCase()}.
      </p>
      <Link
        href={paths.memberApp.home}
        className="flex min-h-11 items-center self-start border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground"
      >
        Back to Home
      </Link>
    </MemberScreen>
  );
}
