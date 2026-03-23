"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Loader2,
  Users,
  ArrowLeft,
  DollarSign,
  Phone,
  Mail,
  ChevronDown,
  Mic,
} from "lucide-react";
import Link from "next/link";
import {
  type GolfCourseProfile,
  type Company,
  type Contact,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CallEntry {
  id: string;
  created_at: string;
  raw_transcript: string | null;
  input_type: string | null;
  rep_name: string | null;
  summary: string | null;
  sentiment: string | null;
  diseases: string[];
  products: string[];
  commitments: string[];
  nudge_count: number;
}

interface CourseData {
  company: Company;
  profile: GolfCourseProfile | null;
  contacts: Contact[];
  calls: CallEntry[];
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;
  const [data, setData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const [companyRes, profileRes, contactsRes, callLogsRes] =
        await Promise.all([
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
            .from("call_logs")
            .select(
              `id, created_at, raw_transcript, input_type,
               rep:user_profiles(full_name),
               extraction:call_log_extractions(
                 summary, sentiment,
                 diseases_mentioned, products_mentioned,
                 commitments
               )`
            )
            .eq("company_id", courseId)
            .eq("processing_status", "completed")
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

      // Build call entries with nudge counts
      const calls: CallEntry[] = [];

      if (callLogsRes.data) {
        // Batch-fetch nudge counts for all call_logs
        const callIds = callLogsRes.data.map((c) => c.id);
        const { data: nudgeData } = await supabase
          .from("nudges")
          .select("source_call_log_id")
          .in("source_call_log_id", callIds);

        const nudgeCounts: Record<string, number> = {};
        if (nudgeData) {
          for (const n of nudgeData) {
            const key = n.source_call_log_id as string;
            nudgeCounts[key] = (nudgeCounts[key] || 0) + 1;
          }
        }

        for (const cl of callLogsRes.data) {
          const ext = cl.extraction as unknown as {
            summary: string | null;
            sentiment: string | null;
            diseases_mentioned: string[] | null;
            products_mentioned: string[] | null;
            commitments: Array<{ description: string }> | null;
          } | null;

          calls.push({
            id: cl.id,
            created_at: cl.created_at,
            raw_transcript: cl.raw_transcript,
            input_type: cl.input_type,
            rep_name:
              (cl.rep as unknown as { full_name: string | null } | null)
                ?.full_name || null,
            summary: ext?.summary || null,
            sentiment: ext?.sentiment || null,
            diseases: ext?.diseases_mentioned || [],
            products: ext?.products_mentioned || [],
            commitments: Array.isArray(ext?.commitments)
              ? ext!.commitments.map((c) =>
                  typeof c === "string" ? c : c.description
                )
              : [],
            nudge_count: nudgeCounts[cl.id] || 0,
          });
        }
      }

      setData({
        company: companyRes.data as Company,
        profile: profileRes.data as GolfCourseProfile | null,
        contacts: (contactsRes.data || []) as Contact[],
        calls,
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

  const { company, profile, contacts, calls } = data;

  return (
    <div className="page-enter space-y-6">
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
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile?.maintenance_level && (
            <Badge className="bg-primary/10 text-primary border border-primary/20">
              {profile.maintenance_level}
            </Badge>
          )}
          {(profile?.annual_turf_budget_min ||
            profile?.annual_turf_budget_max) && (
            <Badge variant="outline" className="gap-1">
              <DollarSign className="h-3 w-3" />
              {profile?.annual_turf_budget_min?.toLocaleString() ?? "?"}–
              {profile?.annual_turf_budget_max?.toLocaleString() ?? "?"}
            </Badge>
          )}
          {profile?.ipm_program && (
            <Badge
              variant="outline"
              className="border-green-300 text-green-700 dark:border-green-800 dark:text-green-400"
            >
              IPM
            </Badge>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 1: Course Info                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Course details card */}
        <Card>
          <CardContent className="pt-5 pb-4 space-y-3 text-sm">
            <CourseInfoGrid profile={profile} />
          </CardContent>
        </Card>

        {/* Contacts card */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Contacts ({contacts.length})
              </span>
            </div>
            {contacts.length > 0 ? (
              <div className="space-y-2">
                {contacts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {c.first_name} {c.last_name}
                        </p>
                        {c.role && (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 shrink-0"
                          >
                            {c.role}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No contacts linked
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 2: Call History                                           */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Call History
          <span className="text-sm font-normal text-muted-foreground">
            ({calls.length})
          </span>
        </h2>

        {calls.length === 0 ? (
          <div className="text-center py-12">
            <Mic className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No calls recorded for this course yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => (
              <CallCard key={call.id} call={call} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Course Info Grid (simplified)
// ---------------------------------------------------------------------------
function CourseInfoGrid({ profile }: { profile: GolfCourseProfile | null }) {
  if (!profile) {
    return (
      <p className="text-muted-foreground">No course profile configured</p>
    );
  }

  const rows = [
    { label: "Course Type", value: profile.course_type },
    { label: "Holes", value: profile.num_holes?.toString() },
    { label: "Greens", value: profile.green_grass },
    { label: "Fairways", value: profile.fairway_grass },
    { label: "Maintenance", value: profile.maintenance_level },
  ].filter((r) => r.value);

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <p className="text-xs text-muted-foreground">{r.label}</p>
          <p className="font-medium">{r.value}</p>
        </div>
      ))}
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
// Call Card (expandable)
// ---------------------------------------------------------------------------
const SENTIMENT_DOT: Record<string, string> = {
  positive: "bg-green-500",
  neutral: "bg-slate-400",
  concerned: "bg-orange-500",
  urgent: "bg-red-500",
};

function CallCard({ call }: { call: CallEntry }) {
  const [expanded, setExpanded] = useState(false);

  const dateStr = new Date(call.created_at).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const hasExpandableContent =
    call.raw_transcript ||
    call.diseases.length > 0 ||
    call.products.length > 0 ||
    call.commitments.length > 0;

  return (
    <Card
      className={`transition-colors ${hasExpandableContent ? "cursor-pointer hover:border-primary/30" : ""}`}
      onClick={() => hasExpandableContent && setExpanded(!expanded)}
    >
      <CardContent className="pt-3 pb-3">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Sentiment dot */}
            <div
              className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                call.sentiment
                  ? SENTIMENT_DOT[call.sentiment] || "bg-primary"
                  : "bg-muted-foreground/30"
              }`}
            />
            <span className="text-xs text-muted-foreground shrink-0">
              {dateStr}
            </span>
            {call.rep_name && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground truncate">
                  {call.rep_name}
                </span>
              </>
            )}
            {call.sentiment && (
              <Badge variant="outline" className="text-[10px] h-4 shrink-0">
                {call.sentiment}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {call.nudge_count > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] h-4"
              >
                {call.nudge_count} nudge{call.nudge_count > 1 ? "s" : ""}
              </Badge>
            )}
            {hasExpandableContent && (
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            )}
          </div>
        </div>

        {/* Summary */}
        {call.summary && (
          <p
            className={`text-sm text-muted-foreground mt-1.5 ${
              expanded ? "" : "line-clamp-2"
            }`}
          >
            {call.summary}
          </p>
        )}

        {/* Expanded content */}
        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-3">
            {/* Diseases */}
            {call.diseases.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Diseases / Pests
                </p>
                <div className="flex flex-wrap gap-1">
                  {call.diseases.map((d, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-xs border-red-200 text-red-700 dark:border-red-900 dark:text-red-400"
                    >
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Products */}
            {call.products.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Products Mentioned
                </p>
                <div className="flex flex-wrap gap-1">
                  {call.products.map((p, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-xs border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-400"
                    >
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Commitments */}
            {call.commitments.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Commitments
                </p>
                <ul className="space-y-1">
                  {call.commitments.map((c, i) => (
                    <li
                      key={i}
                      className="text-xs text-muted-foreground flex items-start gap-1.5"
                    >
                      <span className="text-primary mt-0.5">•</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Transcript */}
            {call.raw_transcript && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Transcript
                </p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded-md p-2.5 max-h-48 overflow-y-auto">
                  {call.raw_transcript}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
