"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Stethoscope,
  FlaskConical,
  Plus,
  Trash2,
  Loader2,
  MapPin,
  Sprout,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  CalendarDays,
  DollarSign,
  ClipboardList,
} from "lucide-react";
import type {
  Company,
  GolfCourseProfile,
  VisitReport,
  Deal,
} from "@/lib/types";
import { VoiceInput } from "@/components/voice-input";

// ---------------------------------------------------------------------------
// Types for API responses
// ---------------------------------------------------------------------------
interface Diagnosis {
  issue_name: string;
  type: string;
  confidence: number;
  scientific_name: string | null;
  symptoms_matched: string[];
  contributing_factors: string[];
  severity: string;
  cultural_recommendations: string[];
  reasoning: string;
}

interface DiagnoseResponse {
  diagnoses: Diagnosis[];
  follow_up_questions: string[];
  requires_agronomist: boolean;
}

interface Recommendation {
  product_name: string;
  product_id: string;
  pcp_registration_number: string;
  category: string;
  application_rate: number;
  application_rate_unit: string;
  target_area: string;
  mode_of_action: string | null;
  moa_group: string | null;
  efficacy: string;
  moa_rotation_safe: boolean;
  tank_mix_compatible_with: string[];
  re_entry_interval_hours: number | null;
  rain_fast_hours: number | null;
  estimated_cost_cad: number | null;
  notes: string;
}

interface RecommendResponse {
  recommendations: Recommendation[];
  moa_rotation_warnings: string[];
  tank_mix_warnings: string[];
  rate_adjustments?: string[];
  registration_errors?: string[];
  validation?: {
    valid: boolean;
    warnings: string[];
    errors: string[];
    clamped: boolean;
  };
}

interface QuoteLineItem {
  product_name: string;
  product_id: string;
  pcp_registration_number: string;
  application_rate: number;
  application_rate_unit: string;
  target_area: string;
  estimated_cost_cad: number | null;
  category: string;
}

interface CourseWithProfile extends Company {
  golf_course_profile: GolfCourseProfile | null;
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function ConsultationPage() {
  return (
    <Suspense>
      <ConsultationPageInner />
    </Suspense>
  );
}

function ConsultationPageInner() {
  const searchParams = useSearchParams();

  // Course selection
  const [courses, setCourses] = useState<CourseWithProfile[]>([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<CourseWithProfile | null>(null);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const courseSearchRef = useRef<HTMLDivElement>(null);

  // Course details
  const [recentVisits, setRecentVisits] = useState<VisitReport[]>([]);
  const [openDeals, setOpenDeals] = useState<Deal[]>([]);

  // Diagnosis
  const [symptoms, setSymptoms] = useState("");
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<DiagnoseResponse | null>(null);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<Diagnosis | null>(null);

  // Recommendations
  const [recommending, setRecommending] = useState(false);
  const [recommendResult, setRecommendResult] = useState<RecommendResponse | null>(null);

  // Quote builder
  const [quoteItems, setQuoteItems] = useState<QuoteLineItem[]>([]);
  const [creatingDeal, setCreatingDeal] = useState(false);

  const supabase = createBrowserClient();

  // Load courses on mount
  useEffect(() => {
    async function loadCourses() {
      const { data } = await supabase
        .from("companies")
        .select("*, golf_course_profile:golf_course_profiles(*)")
        .order("name");
      if (data) setCourses(data as unknown as CourseWithProfile[]);
    }
    loadCourses();
  }, [supabase]);

  // Pre-fill from URL params (e.g., from "Consult on This" in call logs)
  useEffect(() => {
    const courseId = searchParams.get("course_id");
    const symptomsParam = searchParams.get("symptoms");

    if (courseId && courses.length > 0 && !selectedCourse) {
      const match = courses.find((c) => c.id === courseId);
      if (match) {
        setSelectedCourse(match);
        setCourseSearch(match.name);
      }
    }
    if (symptomsParam && !symptoms) {
      setSymptoms(symptomsParam);
    }
  }, [searchParams, courses, selectedCourse, symptoms]);

  // Load course details when selected
  useEffect(() => {
    if (!selectedCourse) {
      setRecentVisits([]);
      setOpenDeals([]);
      return;
    }

    async function loadDetails() {
      const [visitsRes, dealsRes] = await Promise.all([
        supabase
          .from("visit_reports")
          .select("id, visit_date, overall_condition, greens_condition, observations")
          .eq("company_id", selectedCourse!.id)
          .order("visit_date", { ascending: false })
          .limit(5),
        supabase
          .from("deals")
          .select("id, name, stage, value_cad, expected_delivery_date")
          .eq("company_id", selectedCourse!.id)
          .not("stage", "in", '("Paid","Closed Lost")')
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (visitsRes.data) setRecentVisits(visitsRes.data as VisitReport[]);
      if (dealsRes.data) setOpenDeals(dealsRes.data as Deal[]);
    }
    loadDetails();
  }, [selectedCourse, supabase]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (courseSearchRef.current && !courseSearchRef.current.contains(e.target as Node)) {
        setShowCourseDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredCourses = courses.filter((c) =>
    c.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
    (c.city && c.city.toLowerCase().includes(courseSearch.toLowerCase()))
  );

  // Diagnose
  const handleDiagnose = useCallback(async () => {
    if (!symptoms.trim()) return;
    setDiagnosing(true);
    setDiagnoseResult(null);
    setSelectedDiagnosis(null);
    setRecommendResult(null);

    try {
      const res = await fetch("/api/turf/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms: symptoms.trim(),
          course_id: selectedCourse?.id,
          grass_type: selectedCourse?.golf_course_profile?.green_grass || undefined,
          season: getCurrentSeason(),
        }),
      });
      const data: DiagnoseResponse = await res.json();
      setDiagnoseResult(data);
    } catch {
      console.error("Diagnosis failed");
    } finally {
      setDiagnosing(false);
    }
  }, [symptoms, selectedCourse]);

  // Recommend
  const handleRecommend = useCallback(async (diagnosis: Diagnosis) => {
    setSelectedDiagnosis(diagnosis);
    setRecommending(true);
    setRecommendResult(null);

    try {
      const res = await fetch("/api/turf/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosis: `${diagnosis.issue_name}: ${diagnosis.reasoning}`,
          course_id: selectedCourse?.id,
          target_area: "Greens",
        }),
      });
      const data: RecommendResponse = await res.json();
      setRecommendResult(data);
    } catch {
      console.error("Recommendation failed");
    } finally {
      setRecommending(false);
    }
  }, [selectedCourse]);

  // Add to quote
  const addToQuote = useCallback((rec: Recommendation) => {
    setQuoteItems((prev) => {
      if (prev.some((q) => q.product_id === rec.product_id)) return prev;
      return [
        ...prev,
        {
          product_name: rec.product_name,
          product_id: rec.product_id,
          pcp_registration_number: rec.pcp_registration_number,
          application_rate: rec.application_rate,
          application_rate_unit: rec.application_rate_unit,
          target_area: rec.target_area,
          estimated_cost_cad: rec.estimated_cost_cad,
          category: rec.category,
        },
      ];
    });
  }, []);

  const removeFromQuote = useCallback((productId: string) => {
    setQuoteItems((prev) => prev.filter((q) => q.product_id !== productId));
  }, []);

  // Create deal from quote
  const handleCreateDeal = useCallback(async () => {
    if (!selectedCourse || quoteItems.length === 0) return;
    setCreatingDeal(true);

    try {
      const total = quoteItems.reduce((sum, q) => sum + (q.estimated_cost_cad || 0), 0);
      const { data: deal } = await supabase
        .from("deals")
        .insert({
          name: `${selectedCourse.name} — ${selectedDiagnosis?.issue_name || "Consultation"} Quote`,
          company_id: selectedCourse.id,
          stage: "Quote Draft",
          value_cad: total,
          notes: `AI-generated from consultation. Diagnosis: ${selectedDiagnosis?.issue_name || "N/A"}`,
        })
        .select("id")
        .single();

      if (deal) {
        const items = quoteItems.map((q) => ({
          deal_id: deal.id,
          name: q.product_name,
          quantity: 1,
          unit_price: q.estimated_cost_cad || 0,
          notes: `PCP#${q.pcp_registration_number} | Rate: ${q.application_rate} ${q.application_rate_unit} | Area: ${q.target_area}`,
          application_rate: q.application_rate,
          target_area: q.target_area,
        }));

        await supabase.from("deal_items").insert(items);
        setQuoteItems([]);

        // Reload open deals
        const { data: deals } = await supabase
          .from("deals")
          .select("id, name, stage, value_cad, expected_delivery_date")
          .eq("company_id", selectedCourse.id)
          .not("stage", "in", '("Paid","Closed Lost")')
          .order("created_at", { ascending: false })
          .limit(5);
        if (deals) setOpenDeals(deals as Deal[]);
      }
    } catch {
      console.error("Failed to create deal");
    } finally {
      setCreatingDeal(false);
    }
  }, [selectedCourse, quoteItems, selectedDiagnosis, supabase]);

  const quoteTotal = quoteItems.reduce((sum, q) => sum + (q.estimated_cost_cad || 0), 0);

  return (
    <div className="page-enter flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-3.5rem)] gap-0 overflow-hidden -m-4 md:-m-6">
      {/* ================================================================= */}
      {/* LEFT PANEL — Course context (stacks above on mobile) */}
      {/* ================================================================= */}
      <div className="w-full lg:w-80 xl:w-96 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-card overflow-hidden flex flex-col max-h-[40vh] lg:max-h-none">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Course Context
          </h2>

          {/* Course search */}
          <div className="relative" ref={courseSearchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={courseSearch}
              onChange={(e) => {
                setCourseSearch(e.target.value);
                setShowCourseDropdown(true);
              }}
              onFocus={() => setShowCourseDropdown(true)}
              className="pl-9"
            />
            {showCourseDropdown && filteredCourses.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-60 overflow-auto">
                {filteredCourses.slice(0, 10).map((course) => (
                  <button
                    key={course.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
                    onClick={() => {
                      setSelectedCourse(course);
                      setCourseSearch(course.name);
                      setShowCourseDropdown(false);
                    }}
                  >
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{course.name}</p>
                      {course.city && (
                        <p className="text-xs text-muted-foreground">{course.city}, {course.province || "ON"}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {selectedCourse ? (
              <>
                {/* Course quick-view */}
                <Card className="border-primary/20 bg-primary/[0.03]">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sprout className="h-4 w-4 text-primary" />
                      {selectedCourse.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <CourseQuickView profile={selectedCourse.golf_course_profile} city={selectedCourse.city} />
                  </CardContent>
                </Card>

                {/* Recent visits */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Recent Visits
                  </h3>
                  {recentVisits.length > 0 ? (
                    <div className="space-y-1.5">
                      {recentVisits.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between rounded-md bg-accent/50 px-2.5 py-1.5 text-xs"
                        >
                          <span className="text-muted-foreground">{v.visit_date}</span>
                          {v.overall_condition && (
                            <Badge variant="outline" className="text-[10px] h-5">
                              {v.overall_condition}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No recent visits</p>
                  )}
                </div>

                {/* Open quotes/orders */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Open Quotes / Orders
                  </h3>
                  {openDeals.length > 0 ? (
                    <div className="space-y-1.5">
                      {openDeals.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between rounded-md bg-accent/50 px-2.5 py-1.5 text-xs"
                        >
                          <span className="truncate mr-2">{d.name}</span>
                          <span className="text-muted-foreground shrink-0">
                            ${d.value_cad?.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No open quotes</p>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <MapPin className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Select a course to begin consultation
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ================================================================= */}
      {/* RIGHT PANEL — AI consultation flow */}
      {/* ================================================================= */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6 space-y-6 max-w-3xl">
            {/* Header */}
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                AI Consultation
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Describe symptoms, get AI-powered diagnosis and product recommendations
              </p>
            </div>

            {/* Symptom input */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Symptom Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Textarea
                    placeholder="Describe what you're seeing on the course... e.g., 'Small straw-colored patches 2-5 inches across on bentgrass greens, mainly on south-facing slopes. High humidity this week.'"
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    rows={4}
                    className="resize-none pr-12"
                  />
                  <div className="absolute right-2 top-2">
                    <VoiceInput
                      onTranscript={(text) => setSymptoms((prev) => (prev ? `${prev} ${text}` : text))}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleDiagnose}
                    disabled={!symptoms.trim() || diagnosing}
                    className="gap-2"
                  >
                    {diagnosing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Stethoscope className="h-4 w-4" />
                    )}
                    {diagnosing ? "Analyzing..." : "Diagnose"}
                  </Button>
                  {!selectedCourse && symptoms.trim() && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Select a course for more accurate results
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Diagnosis results */}
            {diagnoseResult && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Diagnosis Results
                </h2>

                {diagnoseResult.requires_agronomist && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Low confidence in diagnosis. Recommend consulting a certified agronomist before treatment.
                    </p>
                  </div>
                )}

                {diagnoseResult.diagnoses.map((d, i) => (
                  <DiagnosisCard
                    key={i}
                    diagnosis={d}
                    isSelected={selectedDiagnosis?.issue_name === d.issue_name}
                    onRecommend={() => handleRecommend(d)}
                    recommending={recommending && selectedDiagnosis?.issue_name === d.issue_name}
                  />
                ))}

                {diagnoseResult.follow_up_questions.length > 0 && (
                  <Card className="border-dashed">
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                        Follow-up Questions
                      </p>
                      <ul className="space-y-1">
                        {diagnoseResult.follow_up_questions.map((q, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                            {q}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Recommendation results */}
            {recommendResult && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Product Recommendations
                </h2>

                {/* Validation warnings */}
                {recommendResult.validation && !recommendResult.validation.valid && (
                  <ValidationWarnings
                    warnings={recommendResult.validation.warnings}
                    errors={recommendResult.validation.errors}
                  />
                )}

                {recommendResult.moa_rotation_warnings?.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3">
                    <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      {recommendResult.moa_rotation_warnings.map((w, i) => (
                        <p key={i} className="text-sm text-amber-800 dark:text-amber-200">{w}</p>
                      ))}
                    </div>
                  </div>
                )}

                {recommendResult.rate_adjustments && recommendResult.rate_adjustments.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30 p-3">
                    <ShieldAlert className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      {recommendResult.rate_adjustments.map((w, i) => (
                        <p key={i} className="text-sm text-blue-800 dark:text-blue-200">{w}</p>
                      ))}
                    </div>
                  </div>
                )}

                {recommendResult.recommendations.map((rec, i) => (
                  <RecommendationCard
                    key={i}
                    rec={rec}
                    onAdd={() => addToQuote(rec)}
                    inQuote={quoteItems.some((q) => q.product_id === rec.product_id)}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quote builder — sticky bottom */}
        {quoteItems.length > 0 && (
          <div className="border-t border-border bg-card p-4">
            <div className="max-w-3xl space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Quote Builder
                  <Badge variant="secondary" className="ml-1">{quoteItems.length}</Badge>
                </h3>
                <span className="text-sm font-semibold">
                  Total: ${quoteTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="space-y-1">
                {quoteItems.map((item) => (
                  <div
                    key={item.product_id}
                    className="flex items-center justify-between rounded-md bg-accent/50 px-3 py-1.5 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                        {item.category}
                      </Badge>
                      <span className="truncate">{item.product_name}</span>
                      <span className="text-muted-foreground text-xs shrink-0">
                        {item.application_rate} {item.application_rate_unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {item.estimated_cost_cad ? `$${item.estimated_cost_cad.toLocaleString()}` : "—"}
                      </span>
                      <button
                        onClick={() => removeFromQuote(item.product_id)}
                        className="rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleCreateDeal}
                disabled={creatingDeal || !selectedCourse}
                className="w-full gap-2"
                size="sm"
              >
                {creatingDeal ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {creatingDeal ? "Creating..." : "Create Quote Draft"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CourseQuickView({
  profile,
  city,
}: {
  profile: GolfCourseProfile | null;
  city: string | null;
}) {
  if (!profile) {
    return (
      <p className="text-xs text-muted-foreground">No course profile configured</p>
    );
  }

  const details = [
    profile.num_holes ? `${profile.num_holes} holes` : null,
    profile.total_acreage ? `${profile.total_acreage} acres` : null,
    profile.course_type,
    city,
  ].filter(Boolean);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{details.join(" · ")}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {profile.green_grass && (
          <DetailRow label="Greens" value={profile.green_grass} />
        )}
        {profile.fairway_grass && (
          <DetailRow label="Fairways" value={profile.fairway_grass} />
        )}
        {profile.soil_type && (
          <DetailRow label="Soil" value={profile.soil_type} />
        )}
        {profile.maintenance_level && (
          <DetailRow label="Maintenance" value={profile.maintenance_level} />
        )}
        {(profile.annual_turf_budget_min || profile.annual_turf_budget_max) && (
          <div className="col-span-2">
            <DetailRow
              label="Budget"
              value={`$${profile.annual_turf_budget_min?.toLocaleString() ?? "?"}–$${profile.annual_turf_budget_max?.toLocaleString() ?? "?"}`}
            />
          </div>
        )}
      </div>
      {profile.ipm_program && (
        <Badge variant="outline" className="text-[10px] h-5 border-primary/30 text-primary">
          IPM Program
        </Badge>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="font-medium">{value}</span>
    </div>
  );
}

function DiagnosisCard({
  diagnosis,
  isSelected,
  onRecommend,
  recommending,
}: {
  diagnosis: Diagnosis;
  isSelected: boolean;
  onRecommend: () => void;
  recommending: boolean;
}) {
  const confidencePct = Math.round(diagnosis.confidence * 100);
  const confidenceColor =
    diagnosis.confidence >= 0.7
      ? "bg-green-500"
      : diagnosis.confidence >= 0.4
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <Card className={isSelected ? "ring-2 ring-primary/40" : ""}>
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sm">{diagnosis.issue_name}</h3>
            {diagnosis.scientific_name && (
              <p className="text-xs text-muted-foreground italic">
                {diagnosis.scientific_name}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <Badge
              variant={diagnosis.type === "Disease" ? "destructive" : "secondary"}
              className="text-[10px] h-5 mb-1"
            >
              {diagnosis.type}
            </Badge>
            {diagnosis.severity && (
              <Badge variant="outline" className="text-[10px] h-5 ml-1">
                {diagnosis.severity}
              </Badge>
            )}
          </div>
        </div>

        {/* Confidence bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Confidence</span>
            <span className="font-medium">{confidencePct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${confidenceColor}`}
              style={{ width: `${confidencePct}%` }}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{diagnosis.reasoning}</p>

        {diagnosis.symptoms_matched.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {diagnosis.symptoms_matched.map((s, i) => (
              <Badge key={i} variant="outline" className="text-[10px] h-5">
                {s}
              </Badge>
            ))}
          </div>
        )}

        {diagnosis.cultural_recommendations.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Cultural Recommendations
            </p>
            <ul className="space-y-0.5">
              {diagnosis.cultural_recommendations.map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <CheckCircle2 className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator />

        <Button
          size="sm"
          variant={isSelected ? "default" : "outline"}
          onClick={onRecommend}
          disabled={recommending}
          className="gap-2"
        >
          {recommending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FlaskConical className="h-3.5 w-3.5" />
          )}
          {recommending ? "Loading..." : "Get Recommendations"}
        </Button>
      </CardContent>
    </Card>
  );
}

function RecommendationCard({
  rec,
  onAdd,
  inQuote,
}: {
  rec: Recommendation;
  onAdd: () => void;
  inQuote: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sm">{rec.product_name}</h3>
            <p className="text-xs text-muted-foreground">
              PCP# {rec.pcp_registration_number} · {rec.category}
            </p>
          </div>
          {rec.estimated_cost_cad != null && (
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                {rec.estimated_cost_cad.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">estimated</p>
            </div>
          )}
        </div>

        {/* Key details grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <DetailRow
            label="Rate"
            value={`${rec.application_rate} ${rec.application_rate_unit}`}
          />
          <DetailRow label="Area" value={rec.target_area} />
          {rec.moa_group && <DetailRow label="MOA" value={rec.moa_group} />}
          {rec.efficacy && <DetailRow label="Efficacy" value={rec.efficacy} />}
          {rec.re_entry_interval_hours != null && (
            <DetailRow label="REI" value={`${rec.re_entry_interval_hours}h`} />
          )}
          {rec.rain_fast_hours != null && (
            <DetailRow label="Rain-fast" value={`${rec.rain_fast_hours}h`} />
          )}
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5">
          {!rec.moa_rotation_safe && (
            <Badge variant="destructive" className="text-[10px] h-5 gap-1">
              <ShieldAlert className="h-3 w-3" />
              Resistance Risk
            </Badge>
          )}
          {rec.moa_rotation_safe && (
            <Badge variant="outline" className="text-[10px] h-5 gap-1 border-green-300 text-green-700 dark:border-green-800 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              MOA Rotation Safe
            </Badge>
          )}
          {rec.mode_of_action && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {rec.mode_of_action}
            </Badge>
          )}
        </div>

        {rec.notes && (
          <p className="text-xs text-muted-foreground">{rec.notes}</p>
        )}

        <Button
          size="sm"
          variant={inQuote ? "secondary" : "outline"}
          onClick={onAdd}
          disabled={inQuote}
          className="gap-2"
        >
          {inQuote ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {inQuote ? "Added to Quote" : "Add to Quote"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ValidationWarnings({
  warnings,
  errors,
}: {
  warnings: string[];
  errors: string[];
}) {
  if (warnings.length === 0 && errors.length === 0) return null;

  return (
    <div className="space-y-2">
      {errors.map((e, i) => (
        <div
          key={`err-${i}`}
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-3"
        >
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-800 dark:text-red-200">{e}</p>
        </div>
      ))}
      {warnings.map((w, i) => (
        <div
          key={`warn-${i}`}
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">{w}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "Spring";
  if (month >= 5 && month <= 7) return "Summer";
  if (month >= 8 && month <= 10) return "Fall";
  return "Winter";
}
