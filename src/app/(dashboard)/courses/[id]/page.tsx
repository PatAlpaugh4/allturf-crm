"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MapPin,
  Loader2,
  Users,
  Sprout,
  CalendarDays,
  ShoppingCart,
  ClipboardList,
  Image as ImageIcon,
  GripVertical,
  ArrowLeft,
  DollarSign,
  Droplets,
  FlaskConical,
  Phone,
  Mail,
} from "lucide-react";
import Link from "next/link";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  CONDITION_COLORS,
  CATEGORY_COLORS,
  STAGE_COLORS,
  type ConditionRating,
  type ProductCategory,
  type QuoteStage,
  type GolfCourseProfile,
  type Company,
  type Contact,
  type VisitReport,
  type Deal,
  type ProjectTask,
  type Project,
} from "@/lib/types";

interface ActivityEntry {
  id: string;
  created_at: string;
  type: "call_log" | "activity";
  title: string;
  summary: string | null;
  rep_name: string | null;
  processing_status?: string;
  sentiment?: string | null;
}

interface CourseData {
  company: Company;
  profile: GolfCourseProfile | null;
  contacts: Contact[];
  visits: VisitReport[];
  deals: Deal[];
  program: Project | null;
  programTasks: ProjectTask[];
  activities: ActivityEntry[];
}

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;
  const [data, setData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const [
        companyRes,
        profileRes,
        contactsRes,
        visitsRes,
        dealsRes,
        programRes,
      ] = await Promise.all([
        supabase.from("companies").select("*").eq("id", courseId).single(),
        supabase
          .from("golf_course_profiles")
          .select("*")
          .eq("company_id", courseId)
          .maybeSingle(),
        supabase
          .from("contacts")
          .select("*")
          .eq("company_id", courseId)
          .order("role"),
        supabase
          .from("visit_reports")
          .select("*")
          .eq("company_id", courseId)
          .order("visit_date", { ascending: false })
          .limit(20),
        supabase
          .from("deals")
          .select("*, deal_items:deal_items(*, offering:offerings(name, category))")
          .eq("company_id", courseId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("projects")
          .select("*")
          .eq("company_id", courseId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      let programTasks: ProjectTask[] = [];
      if (programRes.data) {
        const { data: tasks } = await supabase
          .from("project_tasks")
          .select("*, product:offerings(name, category, moa_group, pcp_registration_number)")
          .eq("project_id", programRes.data.id)
          .order("sort_order");
        if (tasks) programTasks = tasks as unknown as ProjectTask[];
      }

      // Fetch call logs + activities for the activity timeline
      const [callLogsRes, activitiesRes] = await Promise.all([
        supabase
          .from("call_logs")
          .select(
            `id, created_at, processing_status, raw_transcript,
             rep:user_profiles(full_name),
             extraction:call_log_extractions(summary, sentiment)`
          )
          .eq("company_id", courseId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("activities")
          .select("id, created_at, type, summary, ai_summary, assigned_rep:user_profiles(full_name)")
          .eq("company_id", courseId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const activityEntries: ActivityEntry[] = [];

      if (callLogsRes.data) {
        for (const cl of callLogsRes.data) {
          const ext = cl.extraction as unknown as { summary: string | null; sentiment: string | null } | null;
          activityEntries.push({
            id: cl.id,
            created_at: cl.created_at,
            type: "call_log",
            title: "Call Log",
            summary: ext?.summary || (cl.raw_transcript ? cl.raw_transcript.slice(0, 120) : null),
            rep_name: (cl.rep as unknown as { full_name: string | null } | null)?.full_name || null,
            processing_status: cl.processing_status,
            sentiment: ext?.sentiment || null,
          });
        }
      }

      if (activitiesRes.data) {
        for (const a of activitiesRes.data) {
          activityEntries.push({
            id: a.id,
            created_at: a.created_at,
            type: "activity",
            title: a.type || "Activity",
            summary: a.ai_summary || a.summary || null,
            rep_name: (a.assigned_rep as unknown as { full_name: string | null } | null)?.full_name || null,
          });
        }
      }

      // Sort by date descending
      activityEntries.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setData({
        company: companyRes.data as Company,
        profile: profileRes.data as GolfCourseProfile | null,
        contacts: (contactsRes.data || []) as Contact[],
        visits: (visitsRes.data || []) as VisitReport[],
        deals: (dealsRes.data || []) as Deal[],
        program: programRes.data as Project | null,
        programTasks,
        activities: activityEntries,
      });
      setLoading(false);
    }
    load();
  }, [courseId, supabase]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { company, profile, contacts, visits, deals, program, programTasks, activities } = data;

  return (
    <div className="page-enter space-y-4">
      {/* Back link */}
      <Link
        href="/courses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All Courses
      </Link>

      {/* Hero header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            {company.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {company.city && (
              <span className="text-sm text-muted-foreground">
                {company.city}, {company.province || "ON"}
              </span>
            )}
            {profile?.num_holes && (
              <Badge variant="outline">{profile.num_holes} holes</Badge>
            )}
            {profile?.total_acreage && (
              <Badge variant="outline">{profile.total_acreage} acres</Badge>
            )}
            {profile?.green_grass && (
              <Badge variant="secondary" className="text-xs">
                {profile.green_grass}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile?.maintenance_level && (
            <Badge className="bg-primary/10 text-primary border border-primary/20">
              {profile.maintenance_level}
            </Badge>
          )}
          {(profile?.annual_turf_budget_min || profile?.annual_turf_budget_max) && (
            <Badge variant="outline" className="gap-1">
              <DollarSign className="h-3 w-3" />
              {profile?.annual_turf_budget_min?.toLocaleString() ?? "?"}–
              {profile?.annual_turf_budget_max?.toLocaleString() ?? "?"}
            </Badge>
          )}
          {profile?.ipm_program && (
            <Badge variant="outline" className="border-green-300 text-green-700 dark:border-green-800 dark:text-green-400">
              IPM
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <ClipboardList className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="treatment-history" className="gap-1.5 text-xs">
            <FlaskConical className="h-3.5 w-3.5" />
            Treatment History
          </TabsTrigger>
          <TabsTrigger value="program" className="gap-1.5 text-xs">
            <Sprout className="h-3.5 w-3.5" />
            Seasonal Program
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5 text-xs">
            <ShoppingCart className="h-3.5 w-3.5" />
            Orders
          </TabsTrigger>
          <TabsTrigger value="visits" className="gap-1.5 text-xs">
            <CalendarDays className="h-3.5 w-3.5" />
            Visits
          </TabsTrigger>
          <TabsTrigger value="photos" className="gap-1.5 text-xs">
            <ImageIcon className="h-3.5 w-3.5" />
            Photos
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5 text-xs">
            <Phone className="h-3.5 w-3.5" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Course details */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Course Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <DetailGrid profile={profile} />
              </CardContent>
            </Card>

            {/* Contacts */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  Contacts ({contacts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contacts.length > 0 ? (
                  <div className="space-y-2">
                    {contacts.map((c) => (
                      <div key={c.id} className="rounded-lg border p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">
                            {c.first_name} {c.last_name}
                          </p>
                          {c.role && (
                            <Badge variant="outline" className="text-[10px] h-5">
                              {c.role}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {c.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {c.phone}
                            </span>
                          )}
                          {c.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {c.email}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No contacts linked</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Treatment History */}
        <TabsContent value="treatment-history" className="mt-4">
          <TreatmentHistoryTab courseId={courseId} />
        </TabsContent>

        {/* Seasonal Program */}
        <TabsContent value="program" className="mt-4">
          <SeasonalProgramTab
            program={program}
            tasks={programTasks}
          />
        </TabsContent>

        {/* Orders */}
        <TabsContent value="orders" className="mt-4">
          <OrdersTab deals={deals} />
        </TabsContent>

        {/* Visits */}
        <TabsContent value="visits" className="mt-4">
          <VisitsTab visits={visits} />
        </TabsContent>

        {/* Photos */}
        <TabsContent value="photos" className="mt-4">
          <PhotosTab visits={visits} />
        </TabsContent>

        {/* Activity Timeline */}
        <TabsContent value="activity" className="mt-4">
          <ActivityTimelineTab activities={activities} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Grid
// ---------------------------------------------------------------------------
function DetailGrid({ profile }: { profile: GolfCourseProfile | null }) {
  if (!profile) {
    return <p className="text-muted-foreground">No course profile configured</p>;
  }

  const rows = [
    { label: "Course Type", value: profile.course_type },
    { label: "Greens", value: profile.green_grass },
    { label: "Fairways", value: profile.fairway_grass },
    { label: "Rough", value: profile.rough_grass },
    { label: "Soil Type", value: profile.soil_type },
    { label: "Irrigation", value: profile.irrigation_type },
    { label: "Water Source", value: profile.water_source },
    { label: "USDA Zone", value: profile.usda_zone },
    { label: "Microclimate", value: profile.microclimate_zone },
  ].filter((r) => r.value);

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {rows.map((r) => (
        <div key={r.label}>
          <p className="text-xs text-muted-foreground">{r.label}</p>
          <p className="font-medium">{r.value}</p>
        </div>
      ))}
      {profile.grass_types && profile.grass_types.length > 0 && (
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground mb-1">Grass Types</p>
          <div className="flex flex-wrap gap-1">
            {profile.grass_types.map((g, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {g}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {profile.notes && (
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Notes</p>
          <p className="text-sm">{profile.notes}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Treatment History Tab
// ---------------------------------------------------------------------------
interface TreatmentEntry {
  id: string;
  visit_date: string;
  product_name: string | null;
  product_category: string | null;
  moa_group: string | null;
  pcp_number: string | null;
  application_rate: number | null;
  target_area: string | null;
  disease_name: string | null;
  notes: string | null;
}

function TreatmentHistoryTab({ courseId }: { courseId: string }) {
  const [entries, setEntries] = useState<TreatmentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("visit_recommendations")
        .select(`
          id, application_rate, target_area, notes,
          product:offerings(name, category, moa_group, pcp_registration_number),
          disease_pest:turf_diseases_pests(name),
          visit_report:visit_reports!inner(company_id, visit_date)
        `)
        .eq("visit_report.company_id", courseId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        const mapped: TreatmentEntry[] = data.map((r) => {
          const product = r.product as unknown as {
            name: string;
            category: string;
            moa_group: string | null;
            pcp_registration_number: string | null;
          } | null;
          const disease = r.disease_pest as unknown as { name: string } | null;
          const report = r.visit_report as unknown as { visit_date: string } | null;
          return {
            id: r.id,
            visit_date: report?.visit_date ?? "",
            product_name: product?.name ?? null,
            product_category: product?.category ?? null,
            moa_group: product?.moa_group ?? null,
            pcp_number: product?.pcp_registration_number ?? null,
            application_rate: r.application_rate,
            target_area: r.target_area,
            disease_name: disease?.name ?? null,
            notes: r.notes,
          };
        });
        setEntries(mapped);
      }
      setLoading(false);
    }
    load();
  }, [courseId, supabase]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <FlaskConical className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No treatment history recorded</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-0">
      {/* Vertical timeline line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

      {entries.map((entry) => (
        <div key={entry.id} className="relative pb-4">
          {/* Timeline dot */}
          <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" />

          <div className="rounded-lg border p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">
                  {entry.visit_date}
                </span>
                {entry.product_category && (
                  <Badge
                    className={`text-[10px] h-4 ${CATEGORY_COLORS[entry.product_category as ProductCategory] || ""}`}
                  >
                    {entry.product_category}
                  </Badge>
                )}
              </div>
              {entry.moa_group && (
                <Badge variant="outline" className="text-[10px] h-4">
                  {entry.moa_group}
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium">
              {entry.product_name || "Unknown product"}
              {entry.pcp_number && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · PCP# {entry.pcp_number}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {entry.disease_name && <span>For: {entry.disease_name}</span>}
              {entry.application_rate != null && (
                <span>Rate: {entry.application_rate}</span>
              )}
              {entry.target_area && <span>Area: {entry.target_area}</span>}
            </div>
            {entry.notes && (
              <p className="text-xs text-muted-foreground">{entry.notes}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seasonal Program Tab (with DnD)
// ---------------------------------------------------------------------------
function SeasonalProgramTab({
  program,
  tasks: initialTasks,
}: {
  program: Project | null;
  tasks: ProjectTask[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const supabase = createBrowserClient();

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;

      const reordered = Array.from(tasks);
      const [moved] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, moved);

      // Update sort_order
      const updated = reordered.map((t, i) => ({ ...t, sort_order: i }));
      setTasks(updated);

      // Persist new order
      for (let i = 0; i < updated.length; i++) {
        await supabase
          .from("project_tasks")
          .update({ sort_order: i })
          .eq("id", updated[i].id);
      }
    },
    [tasks, supabase]
  );

  if (!program) {
    return (
      <div className="text-center py-12">
        <Sprout className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No seasonal program set up</p>
        <Button variant="outline" size="sm" className="mt-3 gap-2">
          <Sprout className="h-4 w-4" />
          Create Program
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{program.name}</h3>
              <p className="text-xs text-muted-foreground">
                {program.project_type} · {program.season_year || "—"}
              </p>
            </div>
            <div className="text-right">
              {program.total_budget != null && (
                <p className="text-sm">
                  Budget: ${program.total_budget.toLocaleString()}
                </p>
              )}
              {program.spent_to_date != null && program.total_budget != null && (
                <div className="mt-1 h-2 w-32 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.min(100, (program.spent_to_date / program.total_budget) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {tasks.length > 0 ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="program-tasks">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                {tasks.map((task, index) => (
                  <Draggable key={task.id} draggableId={task.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`rounded-lg border p-3 bg-card transition-shadow ${
                          snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing text-muted-foreground"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate">
                                {task.title}
                              </p>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {task.application_date && (
                                  <Badge variant="outline" className="text-[10px] h-4">
                                    {task.application_date}
                                  </Badge>
                                )}
                                <Badge
                                  variant={
                                    task.status === "Done"
                                      ? "default"
                                      : task.status === "In Progress"
                                        ? "secondary"
                                        : "outline"
                                  }
                                  className="text-[10px] h-4"
                                >
                                  {task.status}
                                </Badge>
                              </div>
                            </div>
                            {task.product && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {(task.product as unknown as { name: string }).name}
                                {task.application_rate != null && ` · Rate: ${task.application_rate}`}
                                {task.target_area && ` · ${task.target_area}`}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          No treatment items in this program
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders Tab
// ---------------------------------------------------------------------------
function OrdersTab({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No orders yet</p>
      </div>
    );
  }

  // Simple spend summary
  const totalSpent = deals
    .filter((d) => ["Delivered", "Invoiced", "Paid"].includes(d.stage))
    .reduce((sum, d) => sum + (d.value_cad || 0), 0);
  const totalPending = deals
    .filter((d) => !["Delivered", "Invoiced", "Paid", "Closed Lost"].includes(d.stage))
    .reduce((sum, d) => sum + (d.value_cad || 0), 0);

  return (
    <div className="space-y-4">
      {/* Spend summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Delivered / Invoiced</p>
            <p className="text-xl font-bold text-primary">
              ${totalSpent.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-xl font-bold">
              ${totalPending.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Orders table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote/Order</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="hidden md:table-cell">Delivery</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <p className="font-medium text-sm">{d.name}</p>
                  {d.po_number && (
                    <p className="text-xs text-muted-foreground">PO# {d.po_number}</p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={`text-[10px] h-5 ${STAGE_COLORS[d.stage as QuoteStage] || ""}`}>
                    {d.stage}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  ${(d.value_cad || 0).toLocaleString()}
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {d.expected_delivery_date || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visits Tab
// ---------------------------------------------------------------------------
function VisitsTab({ visits }: { visits: VisitReport[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (visits.length === 0) {
    return (
      <div className="text-center py-12">
        <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No visit reports yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visits.map((v) => {
        const isExpanded = expandedId === v.id;
        const conditions = [
          { label: "Overall", value: v.overall_condition },
          { label: "Greens", value: v.greens_condition },
          { label: "Fairways", value: v.fairways_condition },
          { label: "Tees", value: v.tees_condition },
          { label: "Rough", value: v.rough_condition },
        ].filter((c) => c.value);

        return (
          <Card key={v.id}>
            <CardContent className="pt-3 pb-3">
              <button
                className="w-full text-left"
                onClick={() => setExpandedId(isExpanded ? null : v.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground">
                      {v.visit_date}
                    </span>
                    {v.overall_condition && (
                      <Badge
                        className={`text-[10px] h-5 ${CONDITION_COLORS[v.overall_condition as ConditionRating] || ""}`}
                      >
                        {v.overall_condition}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {v.temperature_c != null && <span>{v.temperature_c}°C</span>}
                    {v.photo_urls && v.photo_urls.length > 0 && (
                      <Badge variant="outline" className="text-[10px] h-4 gap-1">
                        <ImageIcon className="h-3 w-3" />
                        {v.photo_urls.length}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-3 space-y-3">
                  <Separator />

                  {/* Condition ratings */}
                  {conditions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {conditions.map((c) => (
                        <div key={c.label} className="text-xs">
                          <span className="text-muted-foreground">{c.label}: </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-4 ${CONDITION_COLORS[c.value as ConditionRating] || ""}`}
                          >
                            {c.value}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Weather */}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {v.temperature_c != null && (
                      <span>Temp: {v.temperature_c}°C</span>
                    )}
                    {v.humidity_percent != null && (
                      <span className="flex items-center gap-1">
                        <Droplets className="h-3 w-3" />
                        {v.humidity_percent}%
                      </span>
                    )}
                    {v.recent_rainfall_mm != null && (
                      <span>Rain: {v.recent_rainfall_mm}mm</span>
                    )}
                    {v.soil_moisture && <span>Soil: {v.soil_moisture}</span>}
                  </div>

                  {v.observations && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">
                        Observations
                      </p>
                      <p className="text-sm">{v.observations}</p>
                    </div>
                  )}

                  {v.recommendations && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">
                        Recommendations
                      </p>
                      <p className="text-sm">{v.recommendations}</p>
                    </div>
                  )}

                  {v.follow_up_actions && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">
                        Follow-up
                      </p>
                      <p className="text-sm">
                        {v.follow_up_actions}
                        {v.follow_up_date && (
                          <span className="text-muted-foreground"> — by {v.follow_up_date}</span>
                        )}
                      </p>
                    </div>
                  )}

                  {v.ai_summary && (
                    <div className="rounded-md bg-primary/5 border border-primary/10 p-3">
                      <p className="text-xs font-medium text-primary mb-0.5">AI Summary</p>
                      <p className="text-sm">{v.ai_summary}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Photos Tab
// ---------------------------------------------------------------------------
function PhotosTab({ visits }: { visits: VisitReport[] }) {
  const allPhotos = visits
    .filter((v) => v.photo_urls && v.photo_urls.length > 0)
    .flatMap((v) =>
      (v.photo_urls || []).map((url) => ({
        url,
        visit_date: v.visit_date,
        condition: v.overall_condition,
      }))
    );

  if (allPhotos.length === 0) {
    return (
      <div className="text-center py-12">
        <ImageIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No photos uploaded yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {allPhotos.map((photo, i) => (
        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
          <img
            src={photo.url}
            alt={`Visit ${photo.visit_date}`}
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
            <p className="text-xs text-white">{photo.visit_date}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Timeline Tab
// ---------------------------------------------------------------------------
function ActivityTimelineTab({ activities }: { activities: ActivityEntry[] }) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <Phone className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No activity recorded yet</p>
      </div>
    );
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const SENTIMENT_DOT: Record<string, string> = {
    positive: "bg-green-500",
    neutral: "bg-slate-400",
    concerned: "bg-orange-500",
    urgent: "bg-red-500",
  };

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-3.5 top-2 bottom-2 w-px bg-border" />

      <div className="space-y-4">
        {activities.map((entry) => (
          <div key={entry.id} className="relative pl-10">
            {/* Timeline dot */}
            <div
              className={`absolute left-2 top-1.5 h-3 w-3 rounded-full border-2 border-background ${
                entry.type === "call_log"
                  ? entry.sentiment
                    ? SENTIMENT_DOT[entry.sentiment] || "bg-primary"
                    : "bg-primary"
                  : "bg-muted-foreground"
              }`}
            />

            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={entry.type === "call_log" ? "default" : "secondary"}
                      className="text-[10px] h-4"
                    >
                      {entry.title}
                    </Badge>
                    {entry.processing_status && entry.processing_status !== "completed" && (
                      <Badge variant="outline" className="text-[10px] h-4">
                        {entry.processing_status}
                      </Badge>
                    )}
                    {entry.sentiment && (
                      <Badge variant="outline" className="text-[10px] h-4">
                        {entry.sentiment}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDate(entry.created_at)}
                  </span>
                </div>
                {entry.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {entry.summary}
                  </p>
                )}
                {entry.rep_name && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {entry.rep_name}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
