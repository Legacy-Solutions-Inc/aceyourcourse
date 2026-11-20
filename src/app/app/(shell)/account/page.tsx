import type { Metadata } from "next";

import { AccountPrivacy } from "@/components/member-app/account-privacy";
import { AccountProfile } from "@/components/member-app/account-profile";
import { MemberScreen } from "@/components/member-app/member-screen";
import { yourExams } from "@/components/member-app/target-exam-view";
import { YourExams } from "@/components/member-app/your-exams";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { manilaDate } from "@/lib/manila-time";
import { paths } from "@/paths";
import { getActiveDevice, latestConsent, listOpenPrivacyRequests } from "@/services/member";

import { signOut } from "../../actions";
import { changeExamDate, removeExam } from "../actions";
import { requestDataCopy, requestDeletion } from "./actions";

export const metadata: Metadata = { title: "Account" };

const heading = "text-[22px] leading-[1.2] font-extrabold";
const section = "flex max-w-2xl flex-col gap-3.5";

/**
 * Account (mockup L595–633; stories 85, 86, 110–112, 133g): the Member's
 * Profile from Google with Sign out; "Your exams", where they edit each
 * Target Exam's Exam Date, remove one, or add another (ticket 03); and
 * Privacy (ticket 18): what they agreed to and when, and their Privacy
 * Requests. Everything is the signed-in Member's own, read fresh. Plans and
 * receipts come with Payments.
 */
export default async function AccountPage() {
  const { member, targetExams } = await requireMemberWithExam(paths.memberApp.account);
  const now = new Date();
  const [device, agreement, requests] = await Promise.all([
    getActiveDevice(member.userId),
    latestConsent(member.userId),
    listOpenPrivacyRequests(member.userId),
  ]);
  // requireMemberWithExam let them in, so they've agreed to the current versions.
  if (!agreement) throw new Error("A Member past the consent check has no agreement.");

  return (
    <MemberScreen eyebrow="06 · ACCOUNT" title="Account">
      <section aria-labelledby="profile" className={section}>
        <h2 id="profile" className={heading}>
          Profile
        </h2>
        <AccountProfile member={member} device={device} signOutAction={signOut} />
      </section>

      <section aria-labelledby="your-exams" className={section}>
        <h2 id="your-exams" className={heading}>
          Your exams
        </h2>
        <p className="max-w-prose text-[15px] leading-normal">
          Each exam has its own countdown. It follows the official exam date until you set your own.
        </p>
        <YourExams
          exams={yourExams(targetExams, now)}
          today={manilaDate(now)}
          changeDateAction={changeExamDate}
          removeAction={removeExam}
        />
      </section>

      <section aria-labelledby="privacy" className={section}>
        <h2 id="privacy" className={heading}>
          Privacy
        </h2>
        <AccountPrivacy
          email={member.email}
          agreement={agreement}
          requests={requests}
          requestDataCopyAction={requestDataCopy}
          requestDeletionAction={requestDeletion}
        />
      </section>
    </MemberScreen>
  );
}
