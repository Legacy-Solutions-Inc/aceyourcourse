import { supportCopy } from "@/content/member-app/support";

interface SupportScreenProps {
  /** The contact email in Settings. */
  contactEmail: string;
}

/**
 * Support's body (mockup L479–492; story 113): how to email AYC, with
 * "Email Support" opening the Member's email app, then the common questions,
 * each opening its answer.
 */
export function SupportScreen({ contactEmail }: SupportScreenProps) {
  const mailto = `mailto:${contactEmail}?subject=${encodeURIComponent(supportCopy.emailSubject)}`;
  return (
    <>
      <div className="flex max-w-[620px] flex-col gap-3.5 border-[1.5px] bg-ayc-paper p-5 shadow-hard wide:p-7">
        <p className="text-[17px] leading-normal">{supportCopy.intro}</p>
        <a
          href={mailto}
          className="flex min-h-14 items-center self-start border-[1.5px] bg-accent px-5.5 text-[17px] font-extrabold text-accent-foreground shadow-hard-sm"
        >
          {supportCopy.emailButton}
        </a>
        <p className="font-mono text-xs wrap-anywhere text-muted-foreground">
          {supportCopy.emailHint} {contactEmail}
        </p>
      </div>

      <section aria-labelledby="common-questions" className="flex max-w-[620px] flex-col gap-2">
        <h2
          id="common-questions"
          className="font-mono text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase"
        >
          {supportCopy.questionsHeading}
        </h2>
        <div className="flex flex-col">
          {supportCopy.questions.map(({ question, answer }) => (
            <details key={question} className="group border-b-[1.5px]">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-base font-semibold [&::-webkit-details-marker]:hidden">
                <span>{question}</span>
                <span aria-hidden="true" className="transition-transform group-open:rotate-90">
                  →
                </span>
              </summary>
              <p className="max-w-prose pb-4 text-[15px] leading-normal">{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
