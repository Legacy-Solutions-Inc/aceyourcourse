import type { WebsiteSettings } from "@/services/catalogue.types";

export interface VisibleAnnouncement {
  /** The id a dismissal is remembered under. */
  id: string;
  messages: Array<{ text: string; href: string }>;
}

/**
 * Pure: the announcement a Visitor actually sees. Messages that need the Member
 * App are dropped while the switch is off. When the switch turns on and brings
 * those messages in, the id changes too, so Visitors who dismissed the bar
 * before launch see it again with the app message.
 */
export function visibleAnnouncement(
  announcement: WebsiteSettings["announcement"],
  { memberAppLive }: Pick<WebsiteSettings, "memberAppLive">,
): VisibleAnnouncement {
  const shown = announcement.messages.filter(
    (message) => memberAppLive || !message.requiresMemberApp,
  );
  const showsMemberApp = shown.some((message) => message.requiresMemberApp);
  return {
    id: showsMemberApp ? `${announcement.id}+member-app` : announcement.id,
    messages: shown.map(({ text, href }) => ({ text, href })),
  };
}
