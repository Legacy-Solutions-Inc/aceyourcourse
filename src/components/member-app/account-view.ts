import { formatDate } from "@/lib/manila-time";
import { PRIVACY_REQUEST_DAYS } from "@/lib/member-app/privacy-requests";
import type { AgreedVersions, PrivacyRequest } from "@/services/member.types";

// How Account words what the Member agreed to and their Privacy Requests
// (Phase 3, ticket 18; stories 110–112). Pure. Every date is the day in
// Asia/Manila.

/** Pure: "You agreed to Terms v2.0 and Privacy v2.0 on 17 Nov 2026." */
export const agreementText = ({
  termsVersion,
  privacyVersion,
  agreedAt,
}: AgreedVersions & { agreedAt: string }) =>
  `You agreed to Terms v${termsVersion} and Privacy v${privacyVersion} on ${formatDate(agreedAt)}.`;

/** Pure: what Account says while the Member's data copy request is open. */
export const dataCopyPendingText = ({ requestedAt }: PrivacyRequest, email: string) =>
  `Data copy requested on ${formatDate(requestedAt)}. AYC will email your data to ${email} within ${PRIVACY_REQUEST_DAYS["data-copy"]} days.`;

/** Pure: what Account says while the Member's deletion request is open. */
export const deletionPendingText = ({ requestedAt, dueOn }: PrivacyRequest) =>
  `Deletion requested on ${formatDate(requestedAt)}. Your account and its data are removed by ${formatDate(dueOn)}.`;
