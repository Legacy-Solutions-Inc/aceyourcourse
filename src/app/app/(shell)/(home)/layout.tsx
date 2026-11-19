import { requireMember } from "@/lib/member-app/guard";
import { paths } from "@/paths";

/**
 * Home's route group. Its loading skeleton (loading.tsx) streams in while
 * the page reads the Member's progress, and a redirect thrown inside a
 * streamed page reaches the browser late, as a client redirect. So the gate,
 * consent and the Active Device run here first, outside the skeleton's
 * boundary, and send anyone they stop away with a plain redirect before
 * anything streams. The page still runs them itself, as every Member App
 * page does.
 */
export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  await requireMember(paths.memberApp.home);
  return children;
}
