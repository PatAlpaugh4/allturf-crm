"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Calendar,
  MapPin,
  Mic,
  Pencil,
  Truck,
  Users,
  CircleAlert,
} from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
  start_time: string | null;
  source: string | null;
  company: { name: string } | null;
}

const EVENT_ICONS: Record<string, typeof Calendar> = {
  site_visit: MapPin,
  delivery: Truck,
  meeting: Users,
  follow_up: Calendar,
  commitment: CircleAlert,
};

export function UpcomingEventsCard() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    if (!profile) { setLoading(false); return; }

    async function load() {
      const today = new Date().toISOString().split("T")[0];

      const { data } = await supabase
        .from("calendar_events")
        .select("id, title, event_type, start_date, start_time, source, company:companies(name)")
        .eq("team_member", profile!.full_name || profile!.email)
        .gte("start_date", today)
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(5);

      if (data) setEvents(data as unknown as CalendarEvent[]);
      setLoading(false);
    }
    load();
  }, [supabase, profile]);

  if (loading) return null;
  if (events.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Upcoming
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {events.map((evt) => {
          const Icon = EVENT_ICONS[evt.event_type] || Calendar;
          const isAI = evt.source === "ai_extracted";
          const SourceIcon = isAI ? Mic : Pencil;
          const dateStr = new Date(evt.start_date + "T12:00:00Z").toLocaleDateString("en-CA", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });

          return (
            <div key={evt.id} className="flex items-center gap-3 rounded-lg border p-2.5">
              <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium truncate">{evt.title}</p>
                  <span title={isAI ? "AI-generated from call" : "Manually created"}><SourceIcon className="h-3 w-3 shrink-0 text-muted-foreground/60" /></span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span>{dateStr}{evt.start_time ? ` at ${evt.start_time.slice(0, 5)}` : ""}</span>
                  {evt.company?.name && (
                    <>
                      <span className="text-muted-foreground/40">|</span>
                      <span>{evt.company.name}</span>
                    </>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                {evt.event_type.replace(/_/g, " ")}
              </Badge>
            </div>
          );
        })}
        <Link
          href="/calendar"
          className="flex items-center justify-center gap-1 pt-1 text-xs text-primary hover:underline"
        >
          View calendar
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
