"use client";

import { QuickCheckInFab } from "@/components/quick-check-in";
import { DailyDigestCard } from "@/components/dashboard/daily-digest-card";
import { RecentCallsCard } from "@/components/dashboard/recent-calls";
import { FieldTrendsCard } from "@/components/dashboard/field-trends";
import { TeamActivityCard } from "@/components/dashboard/team-activity";

export default function DashboardPage() {
  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Sales intelligence overview
        </p>
      </div>

      {/* Top row — recent calls (everyone) + management cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <RecentCallsCard />
        <DailyDigestCard />
        <TeamActivityCard />
      </div>

      {/* Field trends — admin only, full width */}
      <FieldTrendsCard />

      {/* Quick Check-in FAB for mobile */}
      <QuickCheckInFab />
    </div>
  );
}
