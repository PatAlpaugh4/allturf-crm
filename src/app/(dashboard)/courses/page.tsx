"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  MapPin,
  Search,
  Loader2,
  Plus,
  X,
} from "lucide-react";

interface CourseRow {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  num_holes: number | null;
  green_grass: string | null;
  fairway_grass: string | null;
  maintenance_level: string | null;
  last_call_date: string | null;
  active_quote_name: string | null;
  active_quote_value: number | null;
  assigned_rep: string | null;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  const loadCourses = useCallback(async () => {
    try {
      setError(null);
      // Fetch companies with their golf profiles, latest visit, and active quotes
      const { data: companies, error: fetchError } = await supabase
        .from("companies")
        .select(`
          id, name, city, province,
          golf_course_profiles(num_holes, green_grass, fairway_grass, maintenance_level)
        `)
        .order("name");

      if (fetchError) throw fetchError;
      if (!companies) {
        setLoading(false);
        return;
      }

      // Batch-fetch latest calls and active quotes for all companies
      const companyIds = companies.map((c) => c.id);

      const [callsRes, dealsRes, repsRes] = await Promise.all([
        supabase
          .from("call_logs")
          .select("company_id, created_at")
          .in("company_id", companyIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("deals")
          .select("company_id, name, value_cad, stage, assigned_rep_id")
          .in("company_id", companyIds)
          .not("stage", "in", '("Paid","Closed Lost")'),
        supabase.from("user_profiles").select("id, full_name"),
      ]);

      // Index latest call per company
      const callMap = new Map<string, string>();
      if (callsRes.data) {
        for (const cl of callsRes.data) {
          if (cl.company_id && !callMap.has(cl.company_id)) {
            callMap.set(cl.company_id, cl.created_at);
          }
        }
      }

      // Index active quote per company
      const dealMap = new Map<string, { name: string; value_cad: number; assigned_rep_id: string | null }>();
      if (dealsRes.data) {
        for (const d of dealsRes.data) {
          if (d.company_id && !dealMap.has(d.company_id)) {
            dealMap.set(d.company_id, {
              name: d.name,
              value_cad: d.value_cad,
              assigned_rep_id: d.assigned_rep_id,
            });
          }
        }
      }

      // Index rep names
      const repMap = new Map<string, string>();
      if (repsRes.data) {
        for (const r of repsRes.data) {
          if (r.id && r.full_name) repMap.set(r.id, r.full_name);
        }
      }

      const rows: CourseRow[] = companies.map((c) => {
        const courseProfile = (c.golf_course_profiles as unknown as Array<{
          num_holes: number | null;
          green_grass: string | null;
          fairway_grass: string | null;
          maintenance_level: string | null;
        }>)?.[0];
        const lastCall = callMap.get(c.id);
        const deal = dealMap.get(c.id);

        return {
          id: c.id,
          name: c.name,
          city: c.city,
          province: c.province,
          num_holes: courseProfile?.num_holes ?? null,
          green_grass: courseProfile?.green_grass ?? null,
          fairway_grass: courseProfile?.fairway_grass ?? null,
          maintenance_level: courseProfile?.maintenance_level ?? null,
          last_call_date: lastCall ? lastCall.split("T")[0] : null,
          active_quote_name: deal?.name ?? null,
          active_quote_value: deal?.value_cad ?? null,
          assigned_rep: deal?.assigned_rep_id ? repMap.get(deal.assigned_rep_id) ?? null : null,
        };
      });

      setCourses(rows);
      setLoading(false);
    } catch {
      setError("Failed to load courses. Please try again.");
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const filtered = courses.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      (c.assigned_rep && c.assigned_rep.toLowerCase().includes(q))
    );
  });

  return (
    <div className="page-enter space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Courses
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} course{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Course
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button size="sm" variant="outline" onClick={() => loadCourses()}>Retry</Button>
          <button onClick={() => setError(null)} className="text-destructive/60 hover:text-destructive"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, city, or rep..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">City</TableHead>
                <TableHead className="hidden md:table-cell text-center">Holes</TableHead>
                <TableHead className="hidden lg:table-cell">Grass Type</TableHead>
                <TableHead className="hidden md:table-cell">Last Call</TableHead>
                <TableHead className="hidden lg:table-cell">Active Quote</TableHead>
                <TableHead className="hidden xl:table-cell">Rep</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-accent/50 active:bg-accent/70"
                  onClick={() => router.push(`/courses/${c.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.maintenance_level && (
                        <Badge variant="outline" className="text-[10px] h-4 mt-0.5">
                          {c.maintenance_level}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {c.city ? `${c.city}, ${c.province || "ON"}` : "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-center">
                    {c.num_holes ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {c.green_grass || c.fairway_grass || "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {c.last_call_date ? (
                      <p className="text-sm">{c.last_call_date}</p>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {c.active_quote_name ? (
                      <div>
                        <p className="text-sm truncate max-w-[150px]">{c.active_quote_name}</p>
                        <p className="text-xs text-muted-foreground">
                          ${c.active_quote_value?.toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                    {c.assigned_rep || "—"}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No courses found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AddCourseDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(id) => {
          setAddOpen(false);
          router.push(`/courses/${id}`);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Course Dialog
// ---------------------------------------------------------------------------

function AddCourseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const supabase = createBrowserClient();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setCity("");
      setError("");
    }
  }, [open]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Course name is required.");
      return;
    }
    setSaving(true);
    setError("");

    const { data, error: err } = await supabase
      .from("companies")
      .insert({
        name: name.trim(),
        city: city.trim() || null,
        province: "ON",
        industry: "Golf Course",
      })
      .select("id")
      .single();

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    // Create a golf_course_profiles row
    if (data) {
      await supabase.from("golf_course_profiles").insert({ company_id: data.id });
    }

    setSaving(false);
    if (data) onCreated(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Course</DialogTitle>
          <DialogDescription>Create a new golf course entry.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ac-name">Course Name *</Label>
            <Input
              id="ac-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Oakville Golf Club"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ac-city">City</Label>
            <Input
              id="ac-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Oakville"
            />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
