"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Mic,
  Pencil,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";
import { EVENT_TYPES } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  team_member: string | null;
  company_id: string | null;
  contact_id: string | null;
  company_name: string | null;
  contact_name: string | null;
  source: "calendar" | "delivery" | "follow_up" | "ai_extracted" | "manual";
  source_id?: string;
  overdue?: boolean;
  // For manager view: rep info
  rep_name?: string | null;
  rep_territory?: string | null;
}

type ViewMode = "month" | "week";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPE_COLORS: Record<string, string> = {
  site_visit: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  follow_up: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  commitment: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  meeting: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  delivery: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  networking: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  vacation: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  demo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  site_visit: "Site Visit",
  follow_up: "Follow-up",
  commitment: "Commitment",
  meeting: "Meeting",
  delivery: "Delivery",
  networking: "Networking",
  vacation: "Vacation",
  demo: "Demo",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6am–9pm

// Consistent rep colors for manager view
const REP_COLORS = [
  "border-l-blue-500", "border-l-green-500", "border-l-purple-500",
  "border-l-amber-500", "border-l-rose-500", "border-l-cyan-500",
  "border-l-indigo-500", "border-l-emerald-500", "border-l-orange-500",
  "border-l-pink-500", "border-l-teal-500", "border-l-yellow-500",
  "border-l-fuchsia-500", "border-l-lime-500", "border-l-sky-500",
  "border-l-violet-500", "border-l-red-500", "border-l-slate-500",
  "border-l-zinc-500", "border-l-stone-500",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < startDay; i++) cells.push({ day: null, dateStr: null });
  for (let d = 1; d <= totalDays; d++) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({ day: d, dateStr: `${year}-${mm}-${dd}` });
  }
  return cells;
}

function getWeekDates(date: Date): string[] {
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(start.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return toDateStr(d);
  });
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  return toDateStr(new Date());
}

function parseTime(t: string | null): number | null {
  if (!t) return null;
  return parseInt(t.split(":")[0], 10);
}

function formatTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}

function isToday(dateStr: string): boolean {
  return dateStr === todayStr();
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const supabase = createBrowserClient();
  const { profile, isAdmin } = useAuth();

  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  // Reps default to week, managers default to month
  const [view, setView] = useState<ViewMode>(isAdmin ? "month" : "week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reps, setReps] = useState<Array<{ id: string; full_name: string | null; territory: string | null }>>([]);
  const [repFilter, setRepFilter] = useState("all");
  const [territoryFilter, setTerritoryFilter] = useState("all");

  // Event detail
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

  // Create event
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState("");
  const [createTime, setCreateTime] = useState("");


  const calYear = currentDate.getFullYear();
  const calMonth = currentDate.getMonth();

  // Build rep color map for consistent coloring
  const repColorMap = useMemo(() => {
    const map = new Map<string, string>();
    reps.forEach((r, i) => {
      if (r.full_name) map.set(r.full_name, REP_COLORS[i % REP_COLORS.length]);
    });
    return map;
  }, [reps]);

  // Territories for filter
  const territories = useMemo(() => {
    const set = new Set<string>();
    for (const r of reps) {
      if (r.territory) set.add(r.territory);
    }
    return Array.from(set).sort();
  }, [reps]);

  // ------ Data loading ------

  const loadEvents = useCallback(async () => {
    let rangeStart: string;
    let rangeEnd: string;

    if (view === "month") {
      rangeStart = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
      rangeEnd = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${lastDay}`;
    } else {
      const wd = getWeekDates(currentDate);
      rangeStart = wd[0];
      rangeEnd = wd[6];
    }

    const [calRes, dealRes, followUpRes] = await Promise.all([
      // 1. calendar_events
      supabase
        .from("calendar_events")
        .select("*, company:companies(id, name), contact:contacts(id, first_name, last_name)")
        .gte("start_date", rangeStart)
        .lte("start_date", rangeEnd)
        .order("start_date")
        .order("start_time"),

      // 2. Shipped deals with expected_delivery_date
      supabase
        .from("deals")
        .select("id, name, expected_delivery_date, company:companies(id, name), contact:contacts(id, first_name, last_name), assigned_rep_id")
        .eq("stage", "Shipped")
        .not("expected_delivery_date", "is", null)
        .gte("expected_delivery_date", rangeStart)
        .lte("expected_delivery_date", rangeEnd),

      // 3. Contact follow-ups
      supabase
        .from("contacts")
        .select("id, first_name, last_name, next_follow_up, company:companies(id, name)")
        .not("next_follow_up", "is", null)
        .gte("next_follow_up", rangeStart)
        .lte("next_follow_up", rangeEnd),
    ]);

    // Build rep name lookup
    const repMap = new Map<string, { name: string; territory: string | null }>();
    for (const r of reps) {
      if (r.full_name) repMap.set(r.full_name, { name: r.full_name, territory: r.territory });
      repMap.set(r.id, { name: r.full_name || "Unknown", territory: r.territory });
    }

    const all: CalEvent[] = [];

    // Calendar events
    if (calRes.data) {
      for (const e of calRes.data) {
        const co = e.company as { id: string; name: string } | null;
        const ct = e.contact as { id: string; first_name: string; last_name: string } | null;
        const repInfo = e.team_member ? repMap.get(e.team_member) : null;
        all.push({
          id: e.id,
          title: e.title,
          description: e.description,
          event_type: e.event_type,
          start_date: e.start_date,
          end_date: e.end_date,
          start_time: e.start_time,
          end_time: e.end_time,
          is_all_day: e.is_all_day,
          team_member: e.team_member,
          company_id: co?.id ?? null,
          contact_id: ct?.id ?? null,
          company_name: co?.name ?? null,
          contact_name: ct ? `${ct.first_name} ${ct.last_name}` : null,
          source: e.source || "manual",
          rep_name: e.team_member || null,
          rep_territory: repInfo?.territory || null,
        });
      }
    }

    // Deal deliveries
    if (dealRes.data) {
      for (const d of dealRes.data) {
        const co = d.company as unknown as { id: string; name: string } | null;
        const ct = d.contact as unknown as { id: string; first_name: string; last_name: string } | null;
        const repInfo = d.assigned_rep_id ? repMap.get(d.assigned_rep_id) : null;
        all.push({
          id: `deal-${d.id}`,
          title: `Delivery: ${d.name}`,
          description: null,
          event_type: "delivery",
          start_date: d.expected_delivery_date!,
          end_date: null,
          start_time: null,
          end_time: null,
          is_all_day: true,
          team_member: repInfo?.name ?? d.assigned_rep_id,
          company_id: co?.id ?? null,
          contact_id: ct?.id ?? null,
          company_name: co?.name ?? null,
          contact_name: ct ? `${ct.first_name} ${ct.last_name}` : null,
          source: "delivery",
          source_id: d.id,
          rep_name: repInfo?.name ?? null,
          rep_territory: repInfo?.territory ?? null,
        });
      }
    }

    // Contact follow-ups
    if (followUpRes.data) {
      const today = todayStr();
      for (const c of followUpRes.data) {
        const co = c.company as unknown as { id: string; name: string } | null;
        all.push({
          id: `followup-${c.id}`,
          title: `Follow up: ${c.first_name} ${c.last_name}`,
          description: null,
          event_type: "follow_up",
          start_date: c.next_follow_up!,
          end_date: null,
          start_time: null,
          end_time: null,
          is_all_day: true,
          team_member: null,
          company_id: co?.id ?? null,
          contact_id: c.id,
          company_name: co?.name ?? null,
          contact_name: `${c.first_name} ${c.last_name}`,
          source: "follow_up",
          source_id: c.id,
          overdue: c.next_follow_up! < today,
        });
      }
    }

    setEvents(all);
    setLoading(false);
  }, [supabase, calYear, calMonth, view, currentDate, reps]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Load reps for manager filter
  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("user_profiles")
      .select("id, full_name, territory")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => {
        if (data) setReps(data);
      });
  }, [supabase, isAdmin]);

  // ------ Filtered events ------

  const filteredEvents = useMemo(() => {
    let result = events;

    // Rep filter (manager only)
    if (repFilter !== "all") {
      const repInfo = reps.find((r) => r.id === repFilter);
      const repName = repInfo?.full_name;
      result = result.filter((e) =>
        e.team_member === repFilter || e.team_member === repName || !e.team_member
      );
    }

    // Territory filter (manager only)
    if (territoryFilter !== "all") {
      // Find rep names in this territory
      const territoryReps = new Set(
        reps.filter((r) => r.territory === territoryFilter).map((r) => r.full_name)
      );
      result = result.filter((e) =>
        (e.rep_name && territoryReps.has(e.rep_name)) ||
        (e.rep_territory === territoryFilter) ||
        !e.team_member
      );
    }

    return result;
  }, [events, repFilter, territoryFilter, reps]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of filteredEvents) {
      const list = map.get(e.start_date) || [];
      list.push(e);
      map.set(e.start_date, list);
    }
    return map;
  }, [filteredEvents]);

  // ------ Navigation ------

  const goToday = () => setCurrentDate(new Date());

  const goPrev = () => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const goNext = () => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const openCreate = (dateStr?: string, time?: string) => {
    setCreateDate(dateStr || todayStr());
    setCreateTime(time || "");
    setCreateOpen(true);
  };

  const handleEventCreated = () => {
    setCreateOpen(false);
    loadEvents();
  };

  const handleDelete = async (event: CalEvent) => {
    if (event.source === "delivery" || event.source === "follow_up") return;
    if (event.id.startsWith("deal-") || event.id.startsWith("followup-")) return;
    await supabase.from("calendar_events").delete().eq("id", event.id);
    setSelectedEvent(null);
    loadEvents();
  };


  // ------ Title ------

  const viewTitle = useMemo(() => {
    if (view === "month") return `${MONTH_NAMES[calMonth]} ${calYear}`;
    const wd = getWeekDates(currentDate);
    const s = new Date(wd[0] + "T12:00:00");
    const e = new Date(wd[6] + "T12:00:00");
    if (s.getMonth() === e.getMonth()) {
      return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${calYear}`;
    }
    return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${calYear}`;
  }, [view, calMonth, calYear, currentDate]);

  return (
    <div className="page-enter space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""} in view
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => openCreate()}>
          <Plus className="h-4 w-4" />
          New Event
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex rounded-lg border overflow-hidden">
          {(["month", "week"] as ViewMode[]).map((v) => (
            <Button
              key={v}
              variant={view === v ? "default" : "ghost"}
              size="sm"
              className="rounded-none capitalize text-xs px-4"
              onClick={() => setView(v)}
            >
              {v}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goToday} className="text-xs">Today</Button>
          <Button variant="ghost" size="sm" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
          <span className="text-sm font-semibold ml-1">{viewTitle}</span>
        </div>

        {/* Manager filters */}
        {isAdmin && reps.length > 0 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Reps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reps</SelectItem>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.full_name || "Unnamed"}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {territories.length > 0 && (
              <Select value={territoryFilter} onValueChange={setTerritoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Territories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Territories</SelectItem>
                  {territories.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {view === "month" && (
            <MonthView
              year={calYear}
              month={calMonth}
              eventsByDate={eventsByDate}
              onEventClick={setSelectedEvent}
              onDayClick={(d) => openCreate(d)}
              showRepName={isAdmin && repFilter === "all"}
              repColorMap={repColorMap}
            />
          )}
          {view === "week" && (
            <WeekView
              currentDate={currentDate}
              eventsByDate={eventsByDate}
              onEventClick={setSelectedEvent}
              onSlotClick={(d, t) => openCreate(d, t)}
              showRepName={isAdmin && repFilter === "all"}
              repColorMap={repColorMap}
            />
          )}
        </>
      )}

      {/* Event Detail Sheet */}
      <Sheet open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Event Details</SheetTitle>
            <SheetDescription className="sr-only">View event information</SheetDescription>
          </SheetHeader>
          {selectedEvent && (
            <EventDetail
              event={selectedEvent}
              onDelete={() => handleDelete(selectedEvent)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Create Event Dialog */}
      <CreateEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDate={createDate}
        defaultTime={createTime}
        teamMember={profile?.full_name || ""}
        onCreated={handleEventCreated}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source Icon (AI vs Manual)
// ---------------------------------------------------------------------------

function SourceIcon({ source, className = "h-3 w-3" }: { source: string; className?: string }) {
  if (source === "ai_extracted") {
    return <span title="AI-generated from call"><Mic className={`${className} text-primary/70`} /></span>;
  }
  return <span title="Manually created"><Pencil className={`${className} text-muted-foreground/50`} /></span>;
}

// ---------------------------------------------------------------------------
// Month View
// ---------------------------------------------------------------------------

function MonthView({
  year, month, eventsByDate, onEventClick, onDayClick, showRepName, repColorMap,
}: {
  year: number;
  month: number;
  eventsByDate: Map<string, CalEvent[]>;
  onEventClick: (e: CalEvent) => void;
  onDayClick: (dateStr: string) => void;
  showRepName: boolean;
  repColorMap: Map<string, string>;
}) {
  const cells = getMonthDays(year, month);
  const today = todayStr();

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="grid grid-cols-7 gap-px mb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-xs text-muted-foreground text-center font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px">
          {cells.map((cell, idx) => {
            const dayEvts = cell.dateStr ? eventsByDate.get(cell.dateStr) : undefined;
            return (
              <div
                key={idx}
                className={`min-h-[90px] p-1 rounded text-xs cursor-pointer transition-colors hover:bg-accent/50 ${
                  cell.day ? "bg-muted/30" : ""
                }`}
                onClick={() => cell.dateStr && onDayClick(cell.dateStr)}
              >
                {cell.day && (
                  <>
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      cell.dateStr === today ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
                    }`}>
                      {cell.day}
                    </span>
                    {dayEvts && (
                      <div className="mt-0.5 space-y-0.5">
                        {dayEvts.slice(0, 3).map((e) => {
                          const repColor = showRepName && e.rep_name ? repColorMap.get(e.rep_name) : undefined;
                          return (
                            <button
                              key={e.id}
                              type="button"
                              className={`w-full text-left px-1 py-0.5 rounded text-[10px] truncate flex items-center gap-0.5 ${
                                repColor ? `border-l-2 ${repColor} ` : ""
                              }${e.overdue ? EVENT_TYPE_COLORS.commitment : EVENT_TYPE_COLORS[e.event_type] || "bg-blue-50 text-blue-700"}`}
                              onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                            >
                              <SourceIcon source={e.source} className="h-2.5 w-2.5 shrink-0" />
                              {e.start_time && <span className="font-medium">{formatTime(e.start_time).split(" ")[0]} </span>}
                              <span className="truncate">{e.title}</span>
                            </button>
                          );
                        })}
                        {dayEvts.length > 3 && (
                          <span className="text-[10px] text-muted-foreground px-1">+{dayEvts.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Week View
// ---------------------------------------------------------------------------

function WeekView({
  currentDate, eventsByDate, onEventClick, onSlotClick, showRepName, repColorMap,
}: {
  currentDate: Date;
  eventsByDate: Map<string, CalEvent[]>;
  onEventClick: (e: CalEvent) => void;
  onSlotClick: (dateStr: string, time: string) => void;
  showRepName: boolean;
  repColorMap: Map<string, string>;
}) {
  const weekDates = getWeekDates(currentDate);

  return (
    <Card>
      <CardContent className="pt-4 overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px mb-1">
            <div />
            {weekDates.map((ds) => (
              <div key={ds} className={`text-center text-xs font-medium py-1 ${isToday(ds) ? "text-primary" : "text-muted-foreground"}`}>
                {formatDateHeader(ds)}
              </div>
            ))}
          </div>

          {/* All-day row */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px mb-1">
            <div className="text-[10px] text-muted-foreground py-1 text-right pr-2">All day</div>
            {weekDates.map((ds) => {
              const allDay = (eventsByDate.get(ds) || []).filter((e) => e.is_all_day);
              return (
                <div key={ds} className="min-h-[24px] space-y-0.5 px-0.5">
                  {allDay.slice(0, 3).map((e) => {
                    const repColor = showRepName && e.rep_name ? repColorMap.get(e.rep_name) : undefined;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        className={`w-full text-left px-1 py-0.5 rounded text-[10px] truncate flex items-center gap-0.5 ${
                          repColor ? `border-l-2 ${repColor} ` : ""
                        }${e.overdue ? EVENT_TYPE_COLORS.commitment : EVENT_TYPE_COLORS[e.event_type] || ""}`}
                        onClick={() => onEventClick(e)}
                      >
                        <SourceIcon source={e.source} className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{e.title}</span>
                      </button>
                    );
                  })}
                  {allDay.length > 3 && <span className="text-[9px] text-muted-foreground">+{allDay.length - 3}</span>}
                  {showRepName && allDay.length > 0 && allDay[0].rep_name && (
                    <span className="text-[9px] text-muted-foreground/60 truncate block">{allDay[0].rep_name}</span>
                  )}
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Hourly slots */}
          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] gap-px border-t border-border/30">
              <div className="text-[10px] text-muted-foreground py-1 text-right pr-2">{formatHourLabel(hour)}</div>
              {weekDates.map((ds) => {
                const hourEvts = (eventsByDate.get(ds) || []).filter(
                  (e) => !e.is_all_day && parseTime(e.start_time) === hour
                );
                return (
                  <div
                    key={ds}
                    className="min-h-[40px] px-0.5 py-0.5 cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => onSlotClick(ds, `${String(hour).padStart(2, "0")}:00`)}
                  >
                    {hourEvts.map((e) => {
                      const repColor = showRepName && e.rep_name ? repColorMap.get(e.rep_name) : undefined;
                      return (
                        <button
                          key={e.id}
                          type="button"
                          className={`w-full text-left px-1 py-0.5 rounded text-[10px] truncate mb-0.5 flex items-center gap-0.5 ${
                            repColor ? `border-l-2 ${repColor} ` : ""
                          }${EVENT_TYPE_COLORS[e.event_type] || ""}`}
                          onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                        >
                          <SourceIcon source={e.source} className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{formatTime(e.start_time)} {e.title}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Event Detail (Sheet)
// ---------------------------------------------------------------------------

function EventDetail({
  event, onDelete,
}: {
  event: CalEvent;
  onDelete: () => void;
}) {
  const typeColor = event.overdue ? EVENT_TYPE_COLORS.commitment : EVENT_TYPE_COLORS[event.event_type] || "";
  const isEditable = !event.id.startsWith("deal-") && !event.id.startsWith("followup-");
  const isAI = event.source === "ai_extracted";

  return (
    <div className="mt-4 space-y-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold">{event.title}</h3>
          <Badge className={typeColor}>{EVENT_TYPE_LABELS[event.event_type] || event.event_type}</Badge>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {isAI && (
            <Badge variant="outline" className="text-[10px] h-5 gap-1">
              <Mic className="h-3 w-3" />
              AI Generated
            </Badge>
          )}
          {event.overdue && <Badge className="bg-red-100 text-red-700">Overdue</Badge>}
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Date</p>
          <p className="font-medium">{formatDateHeader(event.start_date)}</p>
        </div>
        {event.start_time && (
          <div>
            <p className="text-muted-foreground">Time</p>
            <p className="font-medium">
              {formatTime(event.start_time)}
              {event.end_time && ` – ${formatTime(event.end_time)}`}
            </p>
          </div>
        )}
        {event.company_name && (
          <div>
            <p className="text-muted-foreground">Course</p>
            {event.company_id ? (
              <Link href={`/courses/${event.company_id}`} className="text-primary hover:underline font-medium">
                {event.company_name}
              </Link>
            ) : (
              <p className="font-medium">{event.company_name}</p>
            )}
          </div>
        )}
        {event.contact_name && (
          <div>
            <p className="text-muted-foreground">Contact</p>
            <p className="font-medium">{event.contact_name}</p>
          </div>
        )}
        {event.rep_name && (
          <div>
            <p className="text-muted-foreground">Rep</p>
            <p className="font-medium">{event.rep_name}</p>
          </div>
        )}
      </div>

      {event.description && (
        <>
          <Separator />
          <div>
            <p className="text-sm text-muted-foreground mb-1">Description</p>
            <p className="text-sm whitespace-pre-wrap">{event.description}</p>
          </div>
        </>
      )}

      <Separator />

      <div className="flex flex-wrap gap-2">
        {event.source === "delivery" && (
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <Link href="/pipeline"><Truck className="h-3.5 w-3.5" />View Deal</Link>
          </Button>
        )}
        {event.company_id && (
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <Link href={`/courses/${event.company_id}`}><MapPin className="h-3.5 w-3.5" />View Course</Link>
          </Button>
        )}
        {isEditable && (
          <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:bg-destructive/10" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />Delete
          </Button>
        )}
      </div>

      <div className="pt-2">
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <SourceIcon source={event.source} className="h-3 w-3" />
          {event.source === "ai_extracted" ? "Auto-generated from call" :
           event.source === "delivery" ? "Deal delivery" :
           event.source === "follow_up" ? "Contact follow-up" :
           "Manually created"}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Event Dialog (Simplified)
// ---------------------------------------------------------------------------

function CreateEventDialog({
  open, onOpenChange, defaultDate, defaultTime, teamMember, onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  defaultTime: string;
  teamMember: string;
  onCreated: () => void;
}) {
  const supabase = createBrowserClient();

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<string>("site_visit");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [description, setDescription] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");

  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setEventType("site_visit");
      setStartDate(defaultDate || todayStr());
      setStartTime(defaultTime || "");
      setDescription("");
      setCompanyId("");
      setContactId("");
      setError("");
    }
  }, [open, defaultDate, defaultTime]);

  useEffect(() => {
    if (!open) return;
    supabase.from("companies").select("id, name").order("name").then(({ data }) => {
      if (data) setCompanies(data);
    });
  }, [open, supabase]);

  useEffect(() => {
    if (!companyId) { setContacts([]); setContactId(""); return; }
    supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("company_id", companyId)
      .order("last_name")
      .then(({ data }) => { if (data) setContacts(data); });
  }, [companyId, supabase]);

  const handleSave = async () => {
    if (!title.trim()) { setError("Title is required."); return; }
    if (!startDate) { setError("Date is required."); return; }
    setSaving(true);
    setError("");

    // Site visits default to all-day, meetings are timed
    const isAllDay = eventType === "site_visit" || eventType === "delivery" || !startTime;

    const { error: err } = await supabase.from("calendar_events").insert({
      title: title.trim(),
      event_type: eventType,
      start_date: startDate,
      start_time: isAllDay ? null : startTime || null,
      is_all_day: isAllDay,
      team_member: teamMember,
      description: description.trim() || null,
      company_id: companyId && companyId !== "none" ? companyId : null,
      contact_id: contactId && contactId !== "none" ? contactId : null,
      source: "manual",
    });

    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Event</DialogTitle>
          <DialogDescription>Create a new calendar event.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ce-title">Title *</Label>
            <Input id="ce-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />
          </div>

          <div className="space-y-1.5">
            <Label>Event Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{EVENT_TYPE_LABELS[t] || t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ce-date">Date *</Label>
              <Input id="ce-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            {eventType !== "site_visit" && eventType !== "delivery" && (
              <div className="space-y-1.5">
                <Label htmlFor="ce-time">Time</Label>
                <Input id="ce-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Course</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Select course (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {contacts.length > 0 && (
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger><SelectValue placeholder="Select contact (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ce-desc">Notes</Label>
            <Textarea id="ce-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[60px]" placeholder="Optional notes" />
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
