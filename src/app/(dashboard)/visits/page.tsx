"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Calendar as CalendarIcon,
  List,
  Plus,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import {
  CONDITION_COLORS,
  type ConditionRating,
} from "@/lib/types";
import { VoiceInput } from "@/components/voice-input";
import { PhotoCapture } from "@/components/photo-capture";
import { QuickCheckInFab } from "@/components/quick-check-in";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface VisitRow {
  id: string;
  visit_date: string;
  overall_condition: ConditionRating | null;
  company_name: string | null;
  company_id: string | null;
  rep_name: string | null;
  observations: string | null;
  follow_up_date: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const totalDays = last.getDate();

  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < startDay; i++) cells.push({ day: null, dateStr: null });
  for (let d = 1; d <= totalDays; d++) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({ day: d, dateStr: `${year}-${mm}-${dd}` });
  }
  return cells;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const VISIT_TYPES = ["Routine", "Follow-up", "Demo", "Emergency"] as const;

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function VisitsPage() {
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"calendar" | "list">("list");
  const [calYear, setCalYear] = useState(2026);
  const [calMonth, setCalMonth] = useState(2); // March = 2 (0-indexed)

  // Post-visit form
  const [showReport, setShowReport] = useState(false);

  // Courses and contacts for dropdowns
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; first_name: string; last_name: string; company_id: string | null }>>([]);

  const supabase = createBrowserClient();

  const fetchVisits = useCallback(async () => {
    const { data } = await supabase
      .from("visit_reports")
      .select(`
        id, visit_date, overall_condition, observations, follow_up_date,
        company_id,
        company:companies(name),
        rep:user_profiles(full_name)
      `)
      .order("visit_date", { ascending: false });

    if (data) {
      const rows: VisitRow[] = data.map((v) => {
        const company = v.company as unknown as { name: string } | null;
        const rep = v.rep as unknown as { full_name: string | null } | null;
        return {
          id: v.id,
          visit_date: v.visit_date,
          overall_condition: v.overall_condition as ConditionRating | null,
          company_name: company?.name ?? null,
          company_id: v.company_id,
          rep_name: rep?.full_name ?? null,
          observations: v.observations,
          follow_up_date: v.follow_up_date,
        };
      });
      setVisits(rows);
    }
  }, [supabase]);

  useEffect(() => {
    async function load() {
      const [, coursesRes, contactsRes] = await Promise.all([
        fetchVisits(),
        supabase.from("companies").select("id, name").order("name"),
        supabase.from("contacts").select("id, first_name, last_name, company_id").order("last_name"),
      ]);

      if (coursesRes.data) setCourses(coursesRes.data);
      if (contactsRes.data) setContacts(contactsRes.data as Array<{ id: string; first_name: string; last_name: string; company_id: string | null }>);

      setLoading(false);
    }
    load();
  }, [supabase, fetchVisits]);

  // Calendar visit map
  const visitsByDate = useMemo(() => {
    const map = new Map<string, VisitRow[]>();
    for (const v of visits) {
      const existing = map.get(v.visit_date) || [];
      existing.push(v);
      map.set(v.visit_date, existing);
    }
    return map;
  }, [visits]);

  if (loading) {
    return (
      <div className="page-enter flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Visits
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {visits.length} visit report{visits.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              className="rounded-none gap-1.5"
              onClick={() => setView("list")}
            >
              <List className="h-3.5 w-3.5" />
              List
            </Button>
            <Button
              variant={view === "calendar" ? "default" : "ghost"}
              size="sm"
              className="rounded-none gap-1.5"
              onClick={() => setView("calendar")}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Calendar
            </Button>
          </div>

          <Button size="sm" className="gap-2" onClick={() => setShowReport(true)}>
            <Plus className="h-4 w-4" />
            New Report
          </Button>
        </div>
      </div>

      {/* Calendar View */}
      {view === "calendar" && (
        <Card>
          <CardContent className="pt-4">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (calMonth === 0) {
                    setCalMonth(11);
                    setCalYear((y) => y - 1);
                  } else {
                    setCalMonth((m) => m - 1);
                  }
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="font-semibold">
                {MONTH_NAMES[calMonth]} {calYear}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (calMonth === 11) {
                    setCalMonth(0);
                    setCalYear((y) => y + 1);
                  } else {
                    setCalMonth((m) => m + 1);
                  }
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-px mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-xs text-muted-foreground text-center font-medium py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-px">
              {getMonthDays(calYear, calMonth).map((cell, idx) => {
                const dayVisits = cell.dateStr ? visitsByDate.get(cell.dateStr) : undefined;
                return (
                  <div
                    key={idx}
                    className={`min-h-[80px] p-1 rounded text-xs ${
                      cell.day ? "bg-muted/30" : ""
                    }`}
                  >
                    {cell.day && (
                      <>
                        <span className="text-muted-foreground">{cell.day}</span>
                        {dayVisits && (
                          <div className="mt-1 space-y-0.5">
                            {dayVisits.slice(0, 3).map((v) => (
                              <div
                                key={v.id}
                                className={`px-1 py-0.5 rounded text-[10px] truncate ${
                                  v.overall_condition
                                    ? CONDITION_COLORS[v.overall_condition]
                                    : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {v.company_name || "Visit"}
                              </div>
                            ))}
                            {dayVisits.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{dayVisits.length - 3} more
                              </span>
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
      )}

      {/* List View */}
      {view === "list" && (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="hidden md:table-cell">Notes</TableHead>
                <TableHead className="hidden md:table-cell">Follow-up</TableHead>
                <TableHead className="hidden xl:table-cell">Rep</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visits.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-sm">
                    {v.visit_date}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{v.company_name || "—"}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {v.observations ? (
                      <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                        {v.observations}
                      </p>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {v.follow_up_date ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {v.follow_up_date}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                    {v.rep_name || "—"}
                  </TableCell>
                </TableRow>
              ))}
              {visits.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No visit reports yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* New Visit Report Dialog */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Visit Report</DialogTitle>
          </DialogHeader>
          <VisitForm
            courses={courses}
            contacts={contacts}
            supabase={supabase}
            onSaved={() => {
              setShowReport(false);
              fetchVisits();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Quick Check-in FAB for mobile */}
      <QuickCheckInFab />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simplified Visit Form — capture is king
// ---------------------------------------------------------------------------
function VisitForm({
  courses,
  contacts,
  supabase,
  onSaved,
}: {
  courses: Array<{ id: string; name: string }>;
  contacts: Array<{ id: string; first_name: string; last_name: string; company_id: string | null }>;
  supabase: ReturnType<typeof createBrowserClient>;
  onSaved: () => void;
}) {
  const [courseId, setCourseId] = useState("");
  const [contactId, setContactId] = useState("");
  const [visitType, setVisitType] = useState("Routine");
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split("T")[0]);
  const [observations, setObservations] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  // Filter contacts by selected course
  const filteredContacts = courseId
    ? contacts.filter((c) => c.company_id === courseId)
    : contacts;

  const handleSave = async () => {
    if (!courseId || !visitDate) return;
    setSaving(true);

    await supabase
      .from("visit_reports")
      .insert({
        company_id: courseId,
        contact_id: contactId || null,
        visit_date: visitDate,
        visit_type: visitType,
        observations: observations || null,
        follow_up_date: followUpDate || null,
        photo_urls: photos.length > 0 ? photos.map((f) => f.name) : null,
      });

    setSaving(false);
    onSaved();
  };

  return (
    <div className="space-y-4">
      {/* Course & Contact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Course</Label>
          <Select value={courseId} onValueChange={(val) => { setCourseId(val); setContactId(""); }}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder="Select course" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Contact</Label>
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder="Select contact (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">None</SelectItem>
              {filteredContacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Visit Type & Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Visit Type</Label>
          <Select value={visitType} onValueChange={setVisitType}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="min-h-[44px]"
          />
        </div>
      </div>

      {/* Notes — the main event */}
      <div>
        <div className="flex items-center justify-between">
          <Label>Notes</Label>
          <VoiceInput
            onTranscript={(text) => setObservations((prev) => (prev ? `${prev} ${text}` : text))}
          />
        </div>
        <Textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          placeholder="Dictate or type everything — observations, recommendations, follow-ups. AI will extract the details."
          rows={6}
          className="mt-1 text-base min-h-[140px]"
        />
        {observations && (
          <p className="text-xs text-muted-foreground mt-1">
            {observations.split(/\s+/).filter(Boolean).length} words
          </p>
        )}
      </div>

      {/* Photos */}
      <div>
        <Label className="mb-2 block">Photos (optional)</Label>
        <PhotoCapture photos={photos} onPhotosChange={setPhotos} />
      </div>

      {/* Follow-up date */}
      <div className="max-w-[200px]">
        <Label>Follow-up Date (optional)</Label>
        <Input
          type="date"
          value={followUpDate}
          onChange={(e) => setFollowUpDate(e.target.value)}
          className="min-h-[44px]"
        />
      </div>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={!courseId || !visitDate || saving} className="min-h-[44px]">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Report"
          )}
        </Button>
      </div>
    </div>
  );
}
