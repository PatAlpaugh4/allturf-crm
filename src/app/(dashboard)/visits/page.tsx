"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Brain,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  CONDITION_RATINGS,
  CONDITION_COLORS,
  type ConditionRating,
  type VisitBriefing,
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
  disease_count: number;
}

interface DiseasePestOption {
  id: string;
  name: string;
  type: string;
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
  // Briefing
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefing, setBriefing] = useState<VisitBriefing | null>(null);

  // Courses for dropdowns
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([]);
  // Disease/pest options
  const [diseasePests, setDiseasePests] = useState<DiseasePestOption[]>([]);

  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const [visitsRes, coursesRes, dpRes] = await Promise.all([
        supabase
          .from("visit_reports")
          .select(`
            id, visit_date, overall_condition, observations, follow_up_date,
            company_id,
            company:companies(name),
            rep:user_profiles(full_name),
            visit_observations(id)
          `)
          .order("visit_date", { ascending: false }),
        supabase.from("companies").select("id, name").order("name"),
        supabase
          .from("turf_diseases_pests")
          .select("id, name, type")
          .order("name"),
      ]);

      if (visitsRes.data) {
        const rows: VisitRow[] = visitsRes.data.map((v) => {
          const company = v.company as unknown as { name: string } | null;
          const rep = v.rep as unknown as { full_name: string | null } | null;
          const obs = v.visit_observations as unknown as Array<{ id: string }> | null;
          return {
            id: v.id,
            visit_date: v.visit_date,
            overall_condition: v.overall_condition as ConditionRating | null,
            company_name: company?.name ?? null,
            company_id: v.company_id,
            rep_name: rep?.full_name ?? null,
            observations: v.observations,
            follow_up_date: v.follow_up_date,
            disease_count: obs?.length ?? 0,
          };
        });
        setVisits(rows);
      }

      if (coursesRes.data) setCourses(coursesRes.data);
      if (dpRes.data) setDiseasePests(dpRes.data);

      setLoading(false);
    }
    load();
  }, [supabase]);

  // Visit briefing
  const requestBriefing = useCallback(
    async (courseId: string) => {
      setBriefingOpen(true);
      setBriefingLoading(true);
      setBriefing(null);

      try {
        const res = await fetch("/api/turf/visit-prep", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ course_id: courseId }),
        });
        if (res.ok) {
          const data = await res.json();
          setBriefing(data);
        }
      } catch {
        // silently fail
      } finally {
        setBriefingLoading(false);
      }
    },
    []
  );

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
                <TableHead className="hidden md:table-cell">Condition</TableHead>
                <TableHead className="hidden lg:table-cell">Diseases Found</TableHead>
                <TableHead className="hidden md:table-cell">Follow-up</TableHead>
                <TableHead className="hidden xl:table-cell">Rep</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                    {v.overall_condition ? (
                      <Badge className={`text-[10px] ${CONDITION_COLORS[v.overall_condition]}`}>
                        {v.overall_condition}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {v.disease_count > 0 ? (
                      <Badge variant="outline" className="text-[10px] h-4">
                        {v.disease_count} issue{v.disease_count !== 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">None</span>
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
                  <TableCell className="text-right">
                    {v.company_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => requestBriefing(v.company_id!)}
                      >
                        <Brain className="h-3 w-3" />
                        Briefing
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {visits.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No visit reports yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Briefing Sheet */}
      <Sheet open={briefingOpen} onOpenChange={setBriefingOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Pre-Visit Briefing
            </SheetTitle>
          </SheetHeader>

          {briefingLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Generating briefing...
              </span>
            </div>
          )}

          {briefing && !briefingLoading && (
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-semibold">{briefing.company_name}</h3>
                {briefing.superintendent_name && (
                  <p className="text-sm text-muted-foreground">
                    Superintendent: {briefing.superintendent_name}
                  </p>
                )}
                <p className="text-sm mt-1">{briefing.course_profile_summary}</p>
              </div>

              <Separator />

              {/* Weather */}
              {briefing.recent_weather && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Recent Weather</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Avg Temp: {briefing.recent_weather.avg_temp_c ?? "—"}°C</div>
                    <div>Rainfall: {briefing.recent_weather.total_rainfall_mm ?? "—"}mm</div>
                    <div>GDD: {briefing.recent_weather.gdd_cumulative ?? "—"}</div>
                    <div>
                      Spray Window:{" "}
                      {briefing.recent_weather.is_spray_window ? (
                        <CheckCircle2 className="h-3.5 w-3.5 inline text-green-600" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 inline text-orange-500" />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Active issues */}
              {briefing.active_issues.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Active Issues</h4>
                  <div className="space-y-1">
                    {briefing.active_issues.map((issue, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-[10px] h-4">
                          {issue.type}
                        </Badge>
                        <span>{issue.issue_name}</span>
                        <span className="text-muted-foreground">— {issue.severity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MOA alerts */}
              {briefing.moa_rotation_alerts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-1 flex items-center gap-1 text-orange-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    MOA Rotation Alerts
                  </h4>
                  <ul className="text-sm space-y-0.5 list-disc list-inside text-muted-foreground">
                    {briefing.moa_rotation_alerts.map((a, idx) => (
                      <li key={idx}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Talking points */}
              {briefing.suggested_talking_points.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Suggested Talking Points</h4>
                  <ul className="text-sm space-y-0.5 list-disc list-inside text-muted-foreground">
                    {briefing.suggested_talking_points.map((tp, idx) => (
                      <li key={idx}>{tp}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Upcoming deliveries */}
              {briefing.upcoming_deliveries.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Upcoming Deliveries</h4>
                  <div className="space-y-1">
                    {briefing.upcoming_deliveries.map((del, idx) => (
                      <div key={idx} className="text-sm flex justify-between">
                        <span>{del.deal_name}</span>
                        <span className="text-muted-foreground">{del.scheduled_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Post-Visit Report Dialog */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Visit Report</DialogTitle>
          </DialogHeader>
          <PostVisitForm
            courses={courses}
            diseasePests={diseasePests}
            supabase={supabase}
            onSaved={() => {
              setShowReport(false);
              window.location.reload();
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
// Post-Visit Report Form
// ---------------------------------------------------------------------------
function PostVisitForm({
  courses,
  diseasePests,
  supabase,
  onSaved,
}: {
  courses: Array<{ id: string; name: string }>;
  diseasePests: DiseasePestOption[];
  supabase: ReturnType<typeof createBrowserClient>;
  onSaved: () => void;
}) {
  const [courseId, setCourseId] = useState("");
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split("T")[0]);
  const [overall, setOverall] = useState<ConditionRating | "">("");
  const [greens, setGreens] = useState<ConditionRating | "">("");
  const [fairways, setFairways] = useState<ConditionRating | "">("");
  const [tees, setTees] = useState<ConditionRating | "">("");
  const [rough, setRough] = useState<ConditionRating | "">("");
  const [tempC, setTempC] = useState("");
  const [humidity, setHumidity] = useState("");
  const [rainfall, setRainfall] = useState("");
  const [observations, setObservations] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [followUpActions, setFollowUpActions] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [selectedDiseases, setSelectedDiseases] = useState<Set<string>>(new Set());
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleDisease = (id: string) => {
    setSelectedDiseases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!courseId || !visitDate) return;
    setSaving(true);

    // Insert visit report
    const { data: report } = await supabase
      .from("visit_reports")
      .insert({
        company_id: courseId,
        visit_date: visitDate,
        overall_condition: overall || null,
        greens_condition: greens || null,
        fairways_condition: fairways || null,
        tees_condition: tees || null,
        rough_condition: rough || null,
        temperature_c: tempC ? parseFloat(tempC) : null,
        humidity_percent: humidity ? parseFloat(humidity) : null,
        recent_rainfall_mm: rainfall ? parseFloat(rainfall) : null,
        observations: observations || null,
        recommendations: recommendations || null,
        follow_up_actions: followUpActions || null,
        follow_up_date: followUpDate || null,
        photo_urls: photos.length > 0 ? photos.map((f) => f.name) : null,
      })
      .select("id")
      .single();

    // Insert observations for each selected disease/pest
    if (report && selectedDiseases.size > 0) {
      const obsRows = Array.from(selectedDiseases).map((dpId) => ({
        visit_report_id: report.id,
        disease_pest_id: dpId,
      }));
      await supabase.from("visit_observations").insert(obsRows);
    }

    setSaving(false);
    onSaved();
  };

  return (
    <div className="space-y-4">
      {/* Course & Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Course</Label>
          <Select value={courseId} onValueChange={setCourseId}>
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
          <Label>Visit Date</Label>
          <Input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
          />
        </div>
      </div>

      <Separator />

      {/* Condition Ratings */}
      <div>
        <Label className="text-sm font-medium">Condition Ratings</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <ConditionSelect label="Overall" value={overall} onChange={setOverall} />
          <ConditionSelect label="Greens" value={greens} onChange={setGreens} />
          <ConditionSelect label="Fairways" value={fairways} onChange={setFairways} />
          <ConditionSelect label="Tees" value={tees} onChange={setTees} />
          <ConditionSelect label="Rough" value={rough} onChange={setRough} />
        </div>
      </div>

      <Separator />

      {/* Weather */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
        <div>
          <Label>Temp (°C)</Label>
          <Input
            type="number"
            value={tempC}
            onChange={(e) => setTempC(e.target.value)}
            placeholder="—"
          />
        </div>
        <div>
          <Label>Humidity (%)</Label>
          <Input
            type="number"
            value={humidity}
            onChange={(e) => setHumidity(e.target.value)}
            placeholder="—"
          />
        </div>
        <div>
          <Label>Rainfall (mm)</Label>
          <Input
            type="number"
            value={rainfall}
            onChange={(e) => setRainfall(e.target.value)}
            placeholder="—"
          />
        </div>
      </div>

      <Separator />

      {/* Disease/Pest Checkboxes */}
      <div>
        <Label className="text-sm font-medium">Diseases / Pests Observed</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 mt-2 max-h-[200px] overflow-y-auto">
          {diseasePests.map((dp) => (
            <label
              key={dp.id}
              className="flex items-center gap-2 text-sm cursor-pointer rounded-md px-2 py-2 hover:bg-accent/50 active:bg-accent min-h-[44px]"
            >
              <Checkbox
                checked={selectedDiseases.has(dp.id)}
                onCheckedChange={() => toggleDisease(dp.id)}
              />
              <span className="truncate">{dp.name}</span>
              <Badge variant="outline" className="text-[8px] h-3.5 ml-auto flex-shrink-0">
                {dp.type}
              </Badge>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Photos */}
      <div>
        <Label className="mb-2 block">Photos</Label>
        <PhotoCapture photos={photos} onPhotosChange={setPhotos} />
      </div>

      <Separator />

      {/* Notes */}
      <div>
        <div className="flex items-center justify-between">
          <Label>Observations</Label>
          <VoiceInput
            onTranscript={(text) => setObservations((prev) => (prev ? `${prev} ${text}` : text))}
          />
        </div>
        <Textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          placeholder="Describe what you observed on the course..."
          rows={3}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>Recommendations</Label>
          <VoiceInput
            onTranscript={(text) => setRecommendations((prev) => (prev ? `${prev} ${text}` : text))}
          />
        </div>
        <Textarea
          value={recommendations}
          onChange={(e) => setRecommendations(e.target.value)}
          placeholder="Product recommendations and cultural practices..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between">
            <Label>Follow-up Actions</Label>
            <VoiceInput
              onTranscript={(text) => setFollowUpActions((prev) => (prev ? `${prev} ${text}` : text))}
            />
          </div>
          <Textarea
            value={followUpActions}
            onChange={(e) => setFollowUpActions(e.target.value)}
            placeholder="Next steps..."
            rows={2}
          />
        </div>
        <div>
          <Label>Follow-up Date</Label>
          <Input
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="min-h-[44px]"
          />
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={!courseId || !visitDate || saving}>
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

// ---------------------------------------------------------------------------
// Condition Rating Selector
// ---------------------------------------------------------------------------
function ConditionSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ConditionRating | "";
  onChange: (val: ConditionRating | "") => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-1.5 flex-wrap">
        {CONDITION_RATINGS.map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(value === rating ? "" : rating)}
            className={`px-3 py-2 text-xs rounded-lg border transition-colors min-h-[44px] min-w-[44px] font-medium ${
              value === rating
                ? CONDITION_COLORS[rating]
                : "bg-muted/50 text-muted-foreground hover:bg-muted active:bg-muted"
            }`}
          >
            {rating}
          </button>
        ))}
      </div>
    </div>
  );
}
