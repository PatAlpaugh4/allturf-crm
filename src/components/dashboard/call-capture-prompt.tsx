"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Mic, ChevronRight } from "lucide-react";

/**
 * Prominent "Log a call" card that opens the CallCaptureFab sheet.
 * We dispatch a custom event that the CallCaptureFab listens for.
 */
export function CallCapturePrompt() {
  const handleClick = () => {
    // Trigger the existing CallCaptureFab sheet via custom event
    window.dispatchEvent(new CustomEvent("open-call-capture"));
  };

  return (
    <button onClick={handleClick} className="w-full text-left">
      <Card className="border-primary/30 bg-primary/[0.03] hover:bg-primary/[0.06] transition-colors cursor-pointer">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Mic className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Log a Call</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Record or type your call notes — AI handles the rest
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </button>
  );
}
