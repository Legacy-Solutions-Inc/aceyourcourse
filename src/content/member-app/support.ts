import { PRIVACY_REQUEST_DAYS } from "@/lib/member-app/privacy-requests";

// ─────────────────────────────────────────────────────────────────────────────
// The Member App's Support screen copy (mockup L479–492; story 113), typed so
// a missing string is a type error. The contact email isn't here: it's the
// Owners' Setting, read through the Catalogue seam. The common questions are
// developer-maintained, and say only what the Member App does today: edit
// them when it changes.
// ─────────────────────────────────────────────────────────────────────────────

export interface SupportQuestion {
  question: string;
  answer: string;
}

export const supportCopy = {
  eyebrow: "07 · SUPPORT",
  title: "Need help?",
  intro:
    "Email us about access or your account. Include the email you sign in with so we can find you.",
  emailButton: "Email Support",
  emailSubject: "AceYourCourse support",
  /** Followed by the contact email. */
  emailHint: "Opens your email app, addressed to",
  questionsHeading: "Common questions",
  questions: [
    {
      question: "Why was I signed out on my other device?",
      answer:
        "Only one device can use the Member App at a time. Signing in on a new device signs out the one before. To switch back, sign in again on the device you want to use.",
    },
    {
      question: "How do I change my exam date?",
      answer:
        "Go to Account, find the exam under Your exams, and save a new date. Each exam keeps its own date and countdown.",
    },
    {
      question: "Why is a Topic locked?",
      answer:
        "Free Preview Topics are open to every Member. The rest of an exam’s Topics open with All-Access for that exam. When your access ends, your progress is kept.",
    },
    {
      question: "Does my access renew by itself?",
      answer:
        "No. All-Access lasts a set number of days and never renews or charges you by itself.",
    },
    {
      question: "How do I get a copy of my data, or delete my account?",
      answer: `Go to Account, under Privacy. We email you a copy of your data within ${PRIVACY_REQUEST_DAYS["data-copy"]} days, and remove a deleted account within ${PRIVACY_REQUEST_DAYS.deletion} days.`,
    },
  ] satisfies SupportQuestion[],
};
