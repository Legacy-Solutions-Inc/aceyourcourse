import { resetSampleData } from "@/app/admin/actions";
import { adminMode } from "@/lib/admin/mode";

import { AdminHeader } from "./admin-header";
import { type AdminScreenKey, adminScreen } from "./admin-menu";

interface AdminScreenProps {
  screen: AdminScreenKey;
  primaryAction?: React.ReactNode;
  children?: React.ReactNode;
}

/** One signed-in Admin screen: its header, then its body as the main landmark. */
export function AdminScreen({ screen, primaryAction, children }: AdminScreenProps) {
  const { group, title } = adminScreen(screen);
  return (
    <>
      <AdminHeader
        group={group}
        title={title}
        sampleData={adminMode === "sample" ? { reset: resetSampleData } : undefined}
        primaryAction={primaryAction}
      />
      <main
        id="main"
        className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-5 px-4 pt-4 pb-24 wide:px-7 wide:pt-7 wide:pb-8"
      >
        {children}
      </main>
    </>
  );
}
