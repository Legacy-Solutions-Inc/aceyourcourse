import { DashboardLoading } from "@/components/member-app/dashboard";
import { MemberScreen } from "@/components/member-app/member-screen";

/** Home while it loads (mockup `loading` L493–501): the dashboard's skeleton, in the shell. */
export default function HomeLoading() {
  return (
    <MemberScreen eyebrow="01 · HOME" title="Welcome">
      <DashboardLoading />
    </MemberScreen>
  );
}
