import { MAX_QUERY_LENGTH } from "@/lib/catalogue/product-filters";
import { paths } from "@/paths";
import { USER_FILTERS, type UserFilter, type UserListQuery } from "@/services/admin.types";

// The Users screen's URL (BUILD-MAP §3.10; story 129). The tab, search,
// filter and page live in it, so a reload or a shared link keeps them:
// ?q=bea&filter=beta&page=2, ?tab=beta-testers or ?tab=privacy-requests. Anything else falls back to
// its default.

type SearchParams = Record<string, string | string[] | undefined>;

/** The Users screen's tabs: the Users list, the Beta Testers (ticket 01), and the Privacy Requests (ticket 18). */
const USERS_TABS = ["users", "beta-testers", "privacy-requests"] as const;
export type UsersTab = (typeof USERS_TABS)[number];

/** How many Members one page of the Users list shows. */
export const USERS_PAGE_SIZE = 25;

/** The highest page the URL can ask for; a page past the last shows the last. */
const MAX_PAGE = 99_999;

const isFilter = (value: string): value is UserFilter =>
  (USER_FILTERS as readonly string[]).includes(value);

const isTab = (value: string): value is UsersTab =>
  (USERS_TABS as readonly string[]).includes(value);

/** Pure: the Users screen's tab, and the list's search, filter and page, from its URL's search params. */
export function parseUsersParams(params: SearchParams): { tab: UsersTab; query: UserListQuery } {
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  const q = value("q")?.trim().slice(0, MAX_QUERY_LENGTH) || null;
  const filter = value("filter")?.toLowerCase() ?? "";
  const page = value("page") ?? "";
  const pageNumber = /^\d+$/.test(page) ? Number(page) : 0;
  const tab = value("tab") ?? "";
  return {
    tab: isTab(tab) ? tab : "users",
    query: {
      q,
      filter: isFilter(filter) ? filter : "all",
      page: pageNumber >= 1 && pageNumber <= MAX_PAGE ? pageNumber : 1,
    },
  };
}

/** Pure: the Users list's address for a search, filter and page, leaving the defaults out. */
export function userListHref({ q, filter, page }: UserListQuery): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filter !== "all") params.set("filter", filter);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${paths.admin.users}?${search}` : paths.admin.users;
}
