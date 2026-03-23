"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sprout,
  PhoneCall,
  Bell,
  LayoutDashboard,
  CalendarDays,
  MapPin,
  Kanban,
  FlaskConical,
  Activity,
  FileText,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TourStep {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets?: string[];
}

const tourSteps: TourStep[] = [
  {
    icon: Sprout,
    title: "Welcome to Allturf CRM",
    description:
      "Your field intelligence platform for turf product sales. Reps dictate call notes by voice, AI extracts structured data, and the system generates smart nudges, demand signals, and management digests.",
    bullets: [
      "Voice-first call logging with AI extraction",
      "Smart nudges and cross-rep alerts",
      "Inventory demand signals and trend detection",
    ],
  },
  {
    icon: PhoneCall,
    title: "Voice-First Call Logging",
    description:
      "Reps dictate their call notes after every course visit. AI automatically extracts contacts, products discussed, diseases observed, commitments made, and follow-up actions.",
    bullets: [
      "Tap the microphone FAB to start dictating",
      "AI extracts structured data in seconds",
      "Low-confidence extractions are flagged for review",
    ],
  },
  {
    icon: Bell,
    title: "Smart Nudges",
    description:
      "AI-generated reminders and alerts keep your team on top of opportunities. Nudges include promo matches, cross-rep alerts when another rep sees similar issues, and follow-up reminders.",
    bullets: [
      "Automatic follow-up reminders from call notes",
      "Cross-rep alerts for disease outbreaks and trends",
      "Promotional match suggestions based on field activity",
    ],
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description:
      "Your at-a-glance command center. See recent commitments, weather conditions, active nudges, and demand signals — all in one view.",
    bullets: [
      "Commitment tracking and pipeline summary",
      "Weather snapshots and GDD tracking",
      "Quick access to recent activity",
    ],
  },
  {
    icon: CalendarDays,
    title: "Calendar & Scheduling",
    description:
      "Plan and track course visits, meetings, and follow-ups. Events sync with your workflow so nothing falls through the cracks.",
    bullets: [
      "Visual calendar with event management",
      "Visit planning and scheduling",
      "Integrated with call notes and nudges",
    ],
  },
  {
    icon: MapPin,
    title: "Courses & Contacts",
    description:
      "Complete profiles for every golf course in your territory. Track superintendents, assistants, and key contacts with full interaction history.",
    bullets: [
      "Golf course profiles with territory mapping",
      "Contact management with role tracking",
      "Full interaction history per course",
    ],
  },
  {
    icon: Kanban,
    title: "Deals Pipeline",
    description:
      "Track opportunities through customizable stages from initial interest to closed deals. See your pipeline value and conversion at a glance.",
    bullets: [
      "Drag-and-drop pipeline management",
      "Deal value tracking and forecasting",
      "Activity timeline per opportunity",
    ],
  },
  {
    icon: FlaskConical,
    title: "Products & Inventory",
    description:
      "Browse the full product catalog with Ontario registration details. See stock levels, active promotions, and which products your team is discussing most.",
    bullets: [
      "Full catalog with PCP registration numbers",
      "Stock levels and promotional pricing",
      "Data-driven product surfacing from field activity",
    ],
  },
  {
    icon: Activity,
    title: "Field Intelligence",
    description:
      "Admin view of cross-rep trends, disease outbreak patterns, and demand signals aggregated from all field activity. Spot emerging issues before they spread.",
    bullets: [
      "Cross-territory trend detection",
      "Disease outbreak tracking and alerts",
      "Demand signal aggregation for inventory planning",
    ],
  },
  {
    icon: FileText,
    title: "Daily Digest",
    description:
      "AI-generated management summaries of all field activity. Get a concise daily briefing covering key calls, emerging trends, and items that need attention.",
    bullets: [
      "Automated daily summaries of rep activity",
      "Highlighted trends and action items",
      "Configurable digest preferences",
    ],
  },
];

export function ProductTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const handleOpen = useCallback(() => {
    setStep(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener("allturf:start-tour", handleOpen);
    return () => window.removeEventListener("allturf:start-tour", handleOpen);
  }, [handleOpen]);

  const current = tourSteps[step];
  const isFirst = step === 0;
  const isLast = step === tourSteps.length - 1;
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <div className="p-8 pb-6">
          {/* Icon + Title */}
          <div className="flex items-start gap-4 mb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/15">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 pt-0.5">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {current.title}
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {current.description}
              </DialogDescription>
            </div>
          </div>

          {/* Bullets */}
          {current.bullets && (
            <ul className="ml-16 space-y-1.5 mt-3">
              {current.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  {bullet}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-8 py-4 bg-muted/30">
          {/* Step indicator */}
          <div className="flex items-center gap-1.5">
            {tourSteps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all duration-200 ${
                  i === step
                    ? "w-6 bg-primary"
                    : "w-2 bg-muted-foreground/25 hover:bg-muted-foreground/40"
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            {!isLast && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Skip
              </Button>
            )}
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(step - 1)}
              >
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={() => setOpen(false)}>
                Start Exploring
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                {isFirst ? "Get Started" : "Next"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
