import { Sidebar, MobileNav } from "@/components/sidebar";
import { NudgeBell } from "@/components/nudges/nudge-bell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <MobileNav />
        {/* Desktop top bar — nudge bell + spacer */}
        <div className="hidden lg:flex items-center justify-end border-b border-border/50 px-6 py-2">
          <NudgeBell />
        </div>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
