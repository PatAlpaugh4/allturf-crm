"use client";

import { CallCapturePrompt } from "@/components/dashboard/call-capture-prompt";
import { MyNudgesCard } from "@/components/dashboard/my-nudges";
import { RecentCallsCard } from "@/components/dashboard/recent-calls";
import { MyCommitmentsCard } from "@/components/dashboard/my-commitments";
import { UpcomingEventsCard } from "@/components/dashboard/upcoming-events";
import { WeatherWidget } from "@/components/dashboard/weather-widget";

export function RepDashboard() {
  return (
    <div className="space-y-4">
      {/* Weather widget */}
      <WeatherWidget />

      {/* a. Call Capture prompt */}
      <CallCapturePrompt />

      {/* b + c. Nudges and Recent Calls side by side on desktop */}
      <div className="grid gap-4 md:grid-cols-2">
        <MyNudgesCard />
        <RecentCallsCard />
      </div>

      {/* d + e. Commitments and Upcoming */}
      <div className="grid gap-4 md:grid-cols-2">
        <MyCommitmentsCard />
        <UpcomingEventsCard />
      </div>
    </div>
  );
}
