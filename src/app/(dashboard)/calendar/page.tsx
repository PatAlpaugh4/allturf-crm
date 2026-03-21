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
  List,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Pencil,
  Brain,
  Truck,
  Leaf,
  Users,
} from "lucide-react";
import { EVENT_TYPES, type EventType } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType | "treatment_application" | "follow_up";
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  team_member: string | null;
  location: string | null;
  company_id: string | null;
  contact_id: string | null;
  company_name: string | null;
  contact_name: string | null;
  source: "calendar" | "delivery" | "treatment" | "follow_up";
  source_id?: string;
  overdue?: boolean;
}

type ViewMode = "month" | "week" | "day" | "list";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPE_COLORS: Record<string, string> = {
  site_visit: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  meeting: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  delivery: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  demo: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  vacation: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400",
  networking: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  treatment_application: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  follow_up: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  follow_up_overdue: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  site_visit: "Site Visit",
  meeting: "Meeting",
  delivery: "Delivery",
  demo: "Demo",
  vacation: "Vacation",
  networking: "Networking",
  treatment_application: "Treatment",
  follow_up: "Follow-up",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6am–9pm

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
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reps, setReps] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [repFilter, setRepFilter] = useState("all");

  // Event detail
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

  // Create event
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState("");
  const [createTime, setCreateTime] = useState("");

  // Visit briefing
  const [briefingLoading, setBriefingLoading] = useState(false);

  const calYear = currentDate.getFullYear();
  const calMonth = currentDate.getMonth();

  // ------ Data loading ------

  const loadEvents = useCallback(async () => {
    let rangeStart: string;
    let rangeEnd: string;

    if (view === "month") {
      rangeStart = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
      rangeEnd = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${lastDay}`;
    } else if (view === "week") {
      const wd = getWeekDates(currentDate);
      rangeStart = wd[0];
      rangeEnd = wd[6];
    } else if (view === "day") {
      rangeStart = toDateStr(currentDate);
      rangeEnd = rangeStart;
    } else {
      rangeStart = toDateStr(currentDate);
      const end = new Date(currentDate);
      end.setDate(end.getDate() + 30);
      rangeEnd = toDateStr(end);
    }

    const [calRes, dealRes, taskRes, followUpRes] = await Promise.all([
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

      // 3. Treatment program tasks
      supabase
        .from("project_tasks")
        .select("id, title, application_date, target_area, project:projects(id, name, company:companies(id, name), assigned_rep_id)")
        .not("application_date", "is", null)
        .gte("application_date", rangeStart)
        .lte("application_date", rangeEnd),

      // 4. Contact follow-ups
      supabase
        .from("contacts")
        .select("id, first_name, last_name, next_follow_up, company:companies(id, name)")
        .not("next_follow_up", "is", null)
        .gte("next_follow_up", rangeStart)
        .lte("next_follow_up", rangeEnd),
    ]);

    const all: CalEvent[] = [];

    // Calendar events
    if (calRes.data) {
      for (const e of calRes.data) {
        const co = e.company as { id: string; name: string } | null;
        const ct = e.contact as { id: string; first_name: string; last_name: string } | null;
        all.push({
          id: e.id,
          title: e.title,
          description: e.description,
          event_type: e.event_type as EventType,
          start_date: e.start_date,
          end_date: e.end_date,
          start_time: e.start_time,
          end_time: e.end_time,
          is_all_day: e.is_all_day,
          team_member: e.team_member,
          location: e.location,
          company_id: co?.id ?? null,
          contact_id: ct?.id ?? null,
          company_name: co?.name ?? null,
          contact_name: ct ? `${ct.first_name} ${ct.last_name}` : null,
          source: "calendar",
        });
      }
    }

    // Deal deliveries
    if (dealRes.data) {
      for (const d of dealRes.data) {
        const co = d.company as unknown as { id: string; name: string } | null;
        const ct = d.contact as unknown as { id: string; first_name: string; last_name: string } | null;
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
          team_member: d.assigned_rep_id,
          location: null,
          company_id: co?.id ?? null,
          contact_id: ct?.id ?? null,
          company_name: co?.name ?? null,
          contact_name: ct ? `${ct.first_name} ${ct.last_name}` : null,
          source: "delivery",
          source_id: d.id,
        });
      }
    }

    // Treatment tasks
    if (taskRes.data) {
      for (const t of taskRes.data) {
        const proj = t.project as unknown as { id: string; name: string; company: { id: string; name: string } | null; assigned_rep_id: string | null } | null;
        all.push({
          id: `task-${t.id}`,
          title: t.title,
          description: t.target_area ? `Target: ${t.target_area}` : null,
          event_type: "treatment_application",
          start_date: t.application_date!,
          end_date: null,
          start_time: null,
          end_time: null,
          is_all_day: true,
          team_member: proj?.assigned_rep_id ?? null,
          location: null,
          company_id: proj?.company?.id ?? null,
          contact_id: null,
          company_name: proj?.company?.name ?? null,
          contact_name: null,
          source: "treatment",
          source_id: t.id,
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
          location: null,
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
  }, [supabase, calYear, calMonth, view, currentDate]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Load reps for manager filter
  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("user_profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => {
        if (data) setReps(data);
      });
  }, [supabase, isAdmin]);

  // ------ Filtered events ------

  const filteredEvents = useMemo(() => {
    if (repFilter === "all") return events;
    return events.filter((e) => e.team_member === repFilter || !e.team_member);
  }, [events, repFilter]);

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
    else if (view === "week") d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const goNext = () => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + 1);
    else if (view === "week") d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
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
    if (event.source !== "calendar") return;
    await supabase.from("calendar_events").delete().eq("id", event.id);
    setSelectedEvent(null);
    loadEvents();
  };

  const handleVisitPrep = async (companyId: string) => {
    setBriefingLoading(true);
    try {
      await fetch("/api/turf/visit-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: companyId }),
      });
    } catch {
      // silently fail
    } finally {
      setBriefingLoading(false);
    }
  };

  // ------ Title ------

  const viewTitle = useMemo(() => {
    if (view === "month") return `${MONTH_NAMES[calMonth]} ${calYear}`;
    if (view === "week") {
      const wd = getWeekDates(currentDate);
      const s = new Date(wd[0] + "T12:00:00");
      const e = new Date(wd[6] + "T12:00:00");
      if (s.getMonth() === e.getMonth()) {
        return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${calYear}`;
      }
      return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${calYear}`;
    }
    if (view === "day") {
      return currentDate.toLocaleDateString("en-CA", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });
    }
    return "Upcoming 30 Days";
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
          {(["month", "week", "day", "list"] as ViewMode[]).map((v) => (
            <Button
              key={v}
              variant={view === v ? "default" : "ghost"}
              size="sm"
              className="rounded-none capitalize text-xs px-3"
              onClick={() => setView(v)}
            >
              {v === "list" && <List className="h-3.5 w-3.5 mr-1" />}
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

        {isAdmin && reps.length > 0 && (
          <Select value={repFilter} onValueChange={setRepFilter}>
            <SelectTrigger className="w-[180px] sm:ml-auto">
              <SelectValue placeholder="All Reps" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reps</SelectItem>
              {reps.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.full_name || "Unnamed"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            />
          )}
          {view === "week" && (
            <WeekView
              currentDate={currentDate}
              eventsByDate={eventsByDate}
              onEventClick={setSelectedEvent}
              onSlotClick={(d, t) => openCreate(d, t)}
            />
          )}
          {view === "day" && (
            <DayView
              currentDate={currentDate}
              events={eventsByDate.get(toDateStr(currentDate)) || []}
              onEventClick={setSelectedEvent}
              onSlotClick={(t) => openCreate(toDateStr(currentDate), t)}
            />
          )}
          {view === "list" && (
            <ListView events={filteredEvents} onEventClick={setSelectedEvent} />
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
              onEdit={() => {
                setSelectedEvent(null);
                setCreateDate(selectedEvent.start_date);
                setCreateTime(selectedEvent.start_time || "");
                setCreateOpen(true);
              }}
              onVisitPrep={handleVisitPrep}
              briefingLoading={briefingLoading}
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
// Month View
// ---------------------------------------------------------------------------

function MonthView({
  year, month, eventsByDate, onEventClick, onDayClick,
}: {
  year: number;
  month: number;
  eventsByDate: Map<string, CalEvent[]>;
  onEventClick: (e: CalEvent) => void;
  onDayClick: (dateStr: string) => void;
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
                        {dayEvts.slice(0, 3).map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            className={`w-full text-left px-1 py-0.5 rounded text-[10px] truncate ${
                              e.overdue ? EVENT_TYPE_COLORS.follow_up_overdue : EVENT_TYPE_COLORS[e.event_type] || "bg-blue-50 text-blue-700"
                            }`}
                            onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                          >
                            {e.start_time && <span className="font-medium">{formatTime(e.start_time).split(" ")[0]} </span>}
                            {e.title}
                          </button>
                        ))}
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
  currentDate, eventsByDate, onEventClick, onSlotClick,
}: {
  currentDate: Date;
  eventsByDate: Map<string, CalEvent[]>;
  onEventClick: (e: CalEvent) => void;
  onSlotClick: (dateStr: string, time: string) => void;
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
                  {allDay.slice(0, 2).map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className={`w-full text-left px-1 py-0.5 rounded text-[10px] truncate ${
                        e.overdue ? EVENT_TYPE_COLORS.follow_up_overdue : EVENT_TYPE_COLORS[e.event_type] || ""
                      }`}
                      onClick={() => onEventClick(e)}
                    >
                      {e.title}
                    </button>
                  ))}
                  {allDay.length > 2 && <span className="text-[9px] text-muted-foreground">+{allDay.length - 2}</span>}
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
                    {hourEvts.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        className={`w-full text-left px-1 py-0.5 rounded text-[10px] truncate mb-0.5 ${EVENT_TYPE_COLORS[e.event_type] || ""}`}
                        onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                      >
                        {formatTime(e.start_time)} {e.title}
                      </button>
                    ))}
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
// Day View
// ---------------------------------------------------------------------------

function DayView({
  currentDate, events: dayEvents, onEventClick, onSlotClick,
}: {
  currentDate: Date;
  events: CalEvent[];
  onEventClick: (e: CalEvent) => void;
  onSlotClick: (time: string) => void;
}) {
  const allDay = dayEvents.filter((e) => e.is_all_day);
  const timed = dayEvents.filter((e) => !e.is_all_day);

  return (
    <Card>
      <CardContent className="pt-4">
        {allDay.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-1">All Day</p>
            <div className="flex flex-wrap gap-1.5">
              {allDay.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={`px-2 py-1 rounded text-xs ${
                    e.overdue ? EVENT_TYPE_COLORS.follow_up_overdue : EVENT_TYPE_COLORS[e.event_type] || ""
                  }`}
                  onClick={() => onEventClick(e)}
                >
                  {e.title}
                  {e.company_name && <span className="ml-1 opacity-70">· {e.company_name}</span>}
                </button>
              ))}
            </div>
            <Separator className="mt-3" />
          </div>
        )}

        {HOURS.map((hour) => {
          const hourEvts = timed.filter((e) => parseTime(e.start_time) === hour);
          return (
            <div
              key={hour}
              className="flex border-t border-border/30 min-h-[48px] cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() => onSlotClick(`${String(hour).padStart(2, "0")}:00`)}
            >
              <div className="w-16 shrink-0 text-xs text-muted-foreground py-2 text-right pr-3">
                {formatHourLabel(hour)}
              </div>
              <div className="flex-1 py-1 space-y-1">
                {hourEvts.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className={`w-full text-left px-3 py-1.5 rounded text-sm ${EVENT_TYPE_COLORS[e.event_type] || ""}`}
                    onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                  >
                    <span className="font-medium">{formatTime(e.start_time)}</span>
                    {e.end_time && <span className="text-xs opacity-70"> – {formatTime(e.end_time)}</span>}
                    <span className="ml-2">{e.title}</span>
                    {e.company_name && <span className="ml-1.5 opacity-70 text-xs">· {e.company_name}</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// List View
// ---------------------------------------------------------------------------

function ListView({ events, onEventClick }: { events: CalEvent[]; onEventClick: (e: CalEvent) => void }) {
  const grouped = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    const sorted = [...events].sort((a, b) => {
      if (a.start_date !== b.start_date) return a.start_date.localeCompare(b.start_date);
      return (a.start_time || "").localeCompare(b.start_time || "");
    });
    for (const e of sorted) {
      const list = map.get(e.start_date) || [];
      list.push(e);
      map.set(e.start_date, list);
    }
    return map;
  }, [events]);

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">No upcoming events</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([dateStr, dayEvts]) => (
        <div key={dateStr}>
          <p className={`text-xs font-semibold mb-1.5 ${isToday(dateStr) ? "text-primary" : "text-muted-foreground"}`}>
            {isToday(dateStr) ? "Today · " : ""}{formatDateHeader(dateStr)}
          </p>
          <div className="space-y-1">
            {dayEvts.map((e) => (
              <button
                key={e.id}
                type="button"
                className="w-full text-left flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                onClick={() => onEventClick(e)}
              >
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                  e.overdue ? "bg-red-500" : (EVENT_TYPE_COLORS[e.event_type] || "bg-blue-500").split(" ")[0]
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{e.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {e.start_time && <span>{formatTime(e.start_time)}</span>}
                    {e.company_name && <span>· {e.company_name}</span>}
                    {e.overdue && <Badge className="text-[9px] h-4 bg-red-100 text-red-700">Overdue</Badge>}
                  </div>
                </div>
                <Badge className={`text-[10px] h-5 shrink-0 ${
                  e.overdue ? EVENT_TYPE_COLORS.follow_up_overdue : EVENT_TYPE_COLORS[e.event_type] || ""
                }`}>
                  {EVENT_TYPE_LABELS[e.event_type] || e.event_type}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event Detail (Sheet)
// ---------------------------------------------------------------------------

function EventDetail({
  event, onDelete, onEdit, onVisitPrep, briefingLoading,
}: {
  event: CalEvent;
  onDelete: () => void;
  onEdit: () => void;
  onVisitPrep: (companyId: string) => void;
  briefingLoading: boolean;
}) {
  const typeColor = event.overdue ? EVENT_TYPE_COLORS.follow_up_overdue : EVENT_TYPE_COLORS[event.event_type] || "";

  return (
    <div className="mt-4 space-y-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold">{event.title}</h3>
          <Badge className={typeColor}>{EVENT_TYPE_LABELS[event.event_type] || event.event_type}</Badge>
        </div>
        {event.overdue && <Badge className="mt-1 bg-red-100 text-red-700">Overdue</Badge>}
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
        {event.location && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Location</p>
            <p className="font-medium">{event.location}</p>
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
        {event.event_type === "site_visit" && event.company_id && (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={briefingLoading} onClick={() => onVisitPrep(event.company_id!)}>
            {briefingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
            Prep for Visit
          </Button>
        )}
        {event.source === "delivery" && (
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <Link href="/pipeline"><Truck className="h-3.5 w-3.5" />View Deal</Link>
          </Button>
        )}
        {event.source === "treatment" && (
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <Link href="/programs"><Leaf className="h-3.5 w-3.5" />View Program</Link>
          </Button>
        )}
        {event.source === "follow_up" && (
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <Link href="/contacts"><Users className="h-3.5 w-3.5" />View Contact</Link>
          </Button>
        )}
        {event.company_id && (
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <Link href={`/courses/${event.company_id}`}><MapPin className="h-3.5 w-3.5" />View Course</Link>
          </Button>
        )}
        {event.source === "calendar" && (
          <>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />Edit
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:bg-destructive/10" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />Delete
            </Button>
          </>
        )}
      </div>

      <div className="pt-2">
        <p className="text-[11px] text-muted-foreground">
          Source: {event.source === "calendar" ? "Calendar Event" : event.source === "delivery" ? "Deal Delivery" : event.source === "treatment" ? "Treatment Program" : "Contact Follow-up"}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Event Dialog
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
  const [eventType, setEventType] = useState<string>("meeting");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [description, setDescription] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [location, setLocation] = useState("");

  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setEventType("meeting");
      setStartDate(defaultDate || todayStr());
      setStartTime(defaultTime || "");
      setEndTime("");
      setIsAllDay(!defaultTime);
      setDescription("");
      setCompanyId("");
      setContactId("");
      setLocation("");
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
    setSaving(true);
    setError("");

    const { error: err } = await supabase.from("calendar_events").insert({
      title: title.trim(),
      event_type: eventType,
      start_date: startDate,
      start_time: isAllDay ? null : startTime || null,
      end_time: isAllDay ? null : endTime || null,
      is_all_day: isAllDay,
      team_member: teamMember,
      description: description.trim() || null,
      company_id: companyId && companyId !== "none" ? companyId : null,
      contact_id: contactId && contactId !== "none" ? contactId : null,
      location: location.trim() || null,
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
            <div className="space-y-1.5 flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                <input type="checkbox" className="h-4 w-4 rounded" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} />
                All day
              </label>
            </div>
          </div>

          {!isAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ce-start">Start Time</Label>
                <Input id="ce-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ce-end">End Time</Label>
                <Input id="ce-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          )}

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
            <Label htmlFor="ce-loc">Location</Label>
            <Input id="ce-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ce-desc">Description</Label>
            <Textarea id="ce-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[60px]" />
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
