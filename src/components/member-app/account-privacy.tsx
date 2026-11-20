import Link from "next/link";

import type { DeletionFormState } from "@/app/app/(shell)/account/actions";
import { paths } from "@/paths";
import type { ConsentRecord, PrivacyRequest } from "@/services/member.types";

import { agreementText, dataCopyPendingText, deletionPendingText } from "./account-view";
import { DataCopyRequest, DeleteAccount } from "./privacy-request-buttons";

interface AccountPrivacyProps {
  /** The Member's email, where AYC sends their data. */
  email: string;
  /** Their latest agreement to the Terms and Privacy Policy. */
  agreement: ConsentRecord;
  /** Their open Privacy Requests: at most one of each type. */
  requests: readonly PrivacyRequest[];
  requestDataCopyAction: () => Promise<void>;
  requestDeletionAction: (
    previous: DeletionFormState,
    formData: FormData,
  ) => Promise<DeletionFormState>;
}

const row = "flex min-h-11 items-center border-b border-ayc-ruled py-2 text-[15px] font-semibold";

/**
 * Account's Privacy section (mockup L620–631; stories 110–112): the versions
 * the Member agreed to and when, the Privacy Policy and Terms, then "Request
 * a copy of my data" and "Delete my account", each replaced by what's pending
 * once the Member has asked.
 */
export function AccountPrivacy({
  email,
  agreement,
  requests,
  requestDataCopyAction,
  requestDeletionAction,
}: AccountPrivacyProps) {
  const dataCopy = requests.find((request) => request.type === "data-copy");
  const deletion = requests.find((request) => request.type === "deletion");
  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[15px] leading-normal">{agreementText(agreement)}</p>
      <ul className="flex flex-col border-t-[1.5px]">
        <li>
          <Link href={paths.legal.privacy} className={row}>
            Privacy Policy<span aria-hidden="true">&nbsp;→</span>
          </Link>
        </li>
        <li>
          <Link href={paths.legal.terms} className={row}>
            Terms of Use<span aria-hidden="true">&nbsp;→</span>
          </Link>
        </li>
      </ul>
      <DataCopyRequest
        action={requestDataCopyAction}
        pending={dataCopy ? dataCopyPendingText(dataCopy, email) : null}
      />
      <DeleteAccount
        action={requestDeletionAction}
        pending={deletion ? deletionPendingText(deletion) : null}
      />
    </div>
  );
}
