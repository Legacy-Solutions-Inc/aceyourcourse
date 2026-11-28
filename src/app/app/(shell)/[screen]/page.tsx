import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireMemberWithExam } from "@/lib/member-app/guard";
import { paths } from "@/paths";

export const metadata: Metadata = { title: "Not found" };

interface UnknownScreenPageProps {
  params: Promise<{ screen: string }>;
}

/**
 * Any other address under /app. Every menu screen has its own folder now
 * (Courses arrived last, with Phase 5, ticket 03), so this only answers 404:
 * after the gate, so someone it doesn't let in learns nothing about which
 * addresses exist, and after onboarding, so a Member who is still onboarding
 * goes to Home to pick their Exam.
 */
export default async function UnknownScreenPage({ params }: UnknownScreenPageProps) {
  const { screen } = await params;
  await requireMemberWithExam(`${paths.memberApp.home}/${screen}`);
  notFound();
}
