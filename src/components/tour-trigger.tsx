"use client";

import { Compass } from "lucide-react";

export function TourTrigger() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("allturf:start-tour"))}
      className="mx-3 mb-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Compass className="h-[18px] w-[18px] shrink-0" />
      Take a Tour
    </button>
  );
}
