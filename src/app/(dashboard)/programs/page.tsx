"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  Sprout,
  Brain,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  DollarSign,
  Package,
  Search,
} from "lucide-react";
import {
  PROJECT_TYPES,
  PROJECT_STATUSES,
  type ProjectType,
  type ProjectStatus,
  type Project,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Status color map
// ---------------------------------------------------------------------------
const STATUS_BADGE: Record<ProjectStatus, string> = {
  "Not Started": "bg-slate-100 text-slate-700",
  "In Progress": "bg-blue-100 text-blue-700",
  "On Hold": "bg-yellow-100 text-yellow-700",
  "Completed": "bg-green-100 text-green-700",
  "Cancelled": "bg-red-100 text-red-700",
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function ProgramsPage() {
  const [programs, setPrograms] = useState<
    Array<Project & { company_name: string | null; task_count: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);

  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("projects")
        .select(`
          *,
          company:companies(name),
          project_tasks(id)
        `)
        .order("created_at", { ascending: false });

      if (data) {
        const rows = data.map((p) => {
          const company = p.company as unknown as { name: string } | null;
          const tasks = p.project_tasks as unknown as Array<{ id: string }> | null;
          return {
            ...p,
            project_type: p.project_type as ProjectType,
            status: p.status as ProjectStatus,
            team_members: p.team_members || [],
            value_cad: p.value_cad || 0,
            spent_to_date: p.spent_to_date || 0,
            company_name: company?.name ?? null,
            task_count: tasks?.length ?? 0,
          };
        });
        setPrograms(rows);
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  // Collect unique years
  const years = Array.from(
    new Set(programs.map((p) => p.season_year).filter(Boolean))
  ).sort() as number[];

  const filtered = programs.filter((p) => {
    if (yearFilter !== "all" && String(p.season_year) !== yearFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.company_name && p.company_name.toLowerCase().includes(q))
    );
  });

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
            <Sprout className="h-5 w-5 text-primary" />
            Treatment Programs
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} program{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setWizardOpen(true)}>
          <Brain className="h-4 w-4" />
          AI Program Builder
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search programs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-48"
          />
        </div>

        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {PROJECT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Program Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Sprout className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No programs found</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const budgetPct =
              p.total_budget && p.total_budget > 0
                ? Math.min((p.spent_to_date / p.total_budget) * 100, 100)
                : 0;
            const overBudget = p.total_budget ? p.spent_to_date > p.total_budget : false;

            return (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      {p.company_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {p.company_name}
                        </p>
                      )}
                    </div>
                    <Badge className={`text-[10px] flex-shrink-0 ${STATUS_BADGE[p.status]}`}>
                      {p.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] h-4">
                      {p.project_type}
                    </Badge>
                    {p.season_year && (
                      <span>{p.season_year}</span>
                    )}
                    <span>·</span>
                    <span>{p.task_count} item{p.task_count !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Budget bar */}
                  {p.total_budget && p.total_budget > 0 ? (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={overBudget ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          ${p.spent_to_date.toLocaleString()} spent
                        </span>
                        <span className="text-muted-foreground">
                          ${p.total_budget.toLocaleString()} budget
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            overBudget ? "bg-red-500" : budgetPct > 80 ? "bg-yellow-500" : "bg-primary"
                          }`}
                          style={{ width: `${budgetPct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <DollarSign className="h-3 w-3" />
                      ${p.value_cad.toLocaleString()} value
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* AI Program Builder Wizard */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Program Builder
            </DialogTitle>
          </DialogHeader>
          <ProgramWizard
            supabase={supabase}
            onComplete={() => {
              setWizardOpen(false);
              window.location.reload();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Program Builder Wizard
// ---------------------------------------------------------------------------
interface ProgramItem {
  product_name: string;
  product_id?: string;
  application_rate?: number;
  application_rate_unit?: string;
  target_area?: string;
  timing?: string;
  estimated_cost_cad?: number;
  notes?: string;
}

type WizardStep = "setup" | "generating" | "review" | "saving";

function ProgramWizard({
  supabase,
  onComplete,
}: {
  supabase: ReturnType<typeof createBrowserClient>;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<WizardStep>("setup");

  // Setup
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([]);
  const [courseId, setCourseId] = useState("");
  const [seasonYear, setSeasonYear] = useState("2026");
  const [programType, setProgramType] = useState<string>("");
  const [goals, setGoals] = useState("");
  const [budgetCap, setBudgetCap] = useState("");

  // AI results
  const [programName, setProgramName] = useState("");
  const [items, setItems] = useState<ProgramItem[]>([]);
  const [aiNotes, setAiNotes] = useState("");
  const [validation, setValidation] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    supabase
      .from("companies")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setCourses(data);
      });
  }, [supabase]);

  // Step 1: Generate
  const generate = useCallback(async () => {
    if (!courseId || !programType) return;
    setStep("generating");

    try {
      const res = await fetch("/api/turf/program-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          season_year: parseInt(seasonYear),
          program_type: programType,
          goals: goals || undefined,
          budget_cap: budgetCap ? parseFloat(budgetCap) : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProgramName(data.program_name || `${programType} — ${seasonYear}`);
        setItems(data.items || []);
        setAiNotes(data.notes || "");
        setValidation(data.validation || null);
        setStep("review");
      } else {
        setStep("setup");
      }
    } catch {
      setStep("setup");
    }
  }, [courseId, seasonYear, programType, goals, budgetCap]);

  // Step 3: Convert to Quote
  const convertToQuote = useCallback(async () => {
    setStep("saving");

    // Create project
    const { data: project } = await supabase
      .from("projects")
      .insert({
        name: programName,
        company_id: courseId,
        project_type: programType as ProjectType,
        status: "Not Started" as ProjectStatus,
        season_year: parseInt(seasonYear),
        total_budget: budgetCap ? parseFloat(budgetCap) : null,
      })
      .select("id")
      .single();

    if (project) {
      // Insert program items as tasks
      const taskRows = items.map((item, idx) => ({
        project_id: project.id,
        title: item.product_name,
        description: item.notes || null,
        status: "To Do",
        priority: "Normal",
        sort_order: idx,
        application_rate: item.application_rate ?? null,
        target_area: item.target_area ?? null,
        product_id: item.product_id ?? null,
      }));

      if (taskRows.length > 0) {
        await supabase.from("project_tasks").insert(taskRows);
      }

      // Create a deal (quote draft)
      const totalValue = items.reduce(
        (sum, i) => sum + (i.estimated_cost_cad || 0),
        0
      );

      await supabase.from("deals").insert({
        name: programName,
        company_id: courseId,
        stage: "Quote Draft",
        value_cad: totalValue,
        season: seasonYear,
      });
    }

    onComplete();
  }, [supabase, courseId, programName, programType, seasonYear, budgetCap, items, onComplete]);

  // Remove item
  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      {/* Progress Steps */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <span className={step === "setup" ? "text-primary font-medium" : ""}>
          1. Setup
        </span>
        <ChevronRight className="h-3 w-3" />
        <span className={step === "generating" ? "text-primary font-medium" : ""}>
          2. AI Generate
        </span>
        <ChevronRight className="h-3 w-3" />
        <span className={step === "review" ? "text-primary font-medium" : ""}>
          3. Review
        </span>
        <ChevronRight className="h-3 w-3" />
        <span className={step === "saving" ? "text-primary font-medium" : ""}>
          4. Save
        </span>
      </div>

      {/* Step 1: Setup */}
      {step === "setup" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Course</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger>
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
              <Label>Season Year</Label>
              <Input
                type="number"
                value={seasonYear}
                onChange={(e) => setSeasonYear(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Program Type</Label>
              <Select value={programType} onValueChange={setProgramType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Budget Cap (CAD)</Label>
              <Input
                type="number"
                value={budgetCap}
                onChange={(e) => setBudgetCap(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div>
            <Label>Goals & Notes</Label>
            <Textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="Disease prevention focus, pre-emergent timing, budget constraints..."
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={generate}
              disabled={!courseId || !programType}
              className="gap-2"
            >
              <Brain className="h-4 w-4" />
              Generate Program
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Generating */}
      {step === "generating" && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            AI is building your treatment program...
          </p>
          <p className="text-xs text-muted-foreground">
            Analyzing course profile, weather data, and product catalog
          </p>
        </div>
      )}

      {/* Step 3: Review */}
      {step === "review" && (
        <div className="space-y-4">
          {/* Program name */}
          <div>
            <Label>Program Name</Label>
            <Input
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
            />
          </div>

          {aiNotes && (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              {aiNotes}
            </div>
          )}

          {/* Validation warnings */}
          {validation && (
            <div className="text-xs space-y-1">
              {(validation as { warnings?: string[] }).warnings?.map((w: string, idx: number) => (
                <div key={idx} className="flex items-center gap-1 text-orange-600">
                  <Package className="h-3 w-3" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Items table */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden sm:table-cell">Rate</TableHead>
                  <TableHead className="hidden md:table-cell">Area</TableHead>
                  <TableHead className="hidden md:table-cell">Timing</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <p className="font-medium text-sm">{item.product_name}</p>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {item.notes}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">
                      {item.application_rate
                        ? `${item.application_rate} ${item.application_rate_unit || ""}`
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {item.target_area || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {item.timing || "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {item.estimated_cost_cad
                        ? `$${item.estimated_cost_cad.toLocaleString()}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                        onClick={() => removeItem(idx)}
                      >
                        ×
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center text-sm font-medium px-1">
            <span>
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
            <span>
              Total: $
              {items
                .reduce((s, i) => s + (i.estimated_cost_cad || 0), 0)
                .toLocaleString()}{" "}
              CAD
            </span>
          </div>

          <Separator />

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("setup")}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button onClick={convertToQuote} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Convert to Quote
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Saving */}
      {step === "saving" && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Creating program and quote draft...
          </p>
        </div>
      )}
    </div>
  );
}
