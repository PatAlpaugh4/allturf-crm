"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, FileText } from "lucide-react";

interface DigestSummary {
  digest_date: string;
  total_calls_logged: number;
  total_follow_ups_needed: number;
  key_highlights: string | null;
  generated_at: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rep_activity_breakdown: any;
}

export function DailyDigestCard() {
  const { isAdmin } = useAuth();
  const [digest, setDigest] = useState<DigestSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const supabase = createBrowserClient();

    supabase
      .from("daily_digests")
      .select("digest_date, total_calls_logged, total_follow_ups_needed, key_highlights, generated_at, rep_activity_breakdown")
      .order("digest_date", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        setDigest(data || null);
        setLoading(false);
      });
  }, [isAdmin]);

  // Only visible to admin/manager users
  if (!isAdmin) return null;
  if (loading) return null;

  // Extract executive summary — prefer structured data, fall back to key_highlights
  const structured = digest?.rep_activity_breakdown;
  const isStructured = structured && typeof structured === "object" && !Array.isArray(structured) && "executive_summary" in structured;
  const executiveSummary = isStructured
    ? (structured as { executive_summary?: string }).executive_summary || null
    : digest?.key_highlights
      ? digest.key_highlights.split(/^## /m)[0].trim()
      : null;
  const pipelineValue = isStructured
    ? (structured as { pipeline_snapshot?: { total_pipeline_value?: number } }).pipeline_snapshot?.total_pipeline_value
    : undefined;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Daily Digest
          </span>
          {digest && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              {new Date(digest.digest_date + "T12:00:00Z").toLocaleDateString(
                "en-CA",
                { month: "short", day: "numeric" }
              )}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {digest ? (
          <div className="space-y-3">
            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <div>
                <span className="font-semibold">{digest.total_calls_logged}</span>{" "}
                <span className="text-muted-foreground">calls</span>
              </div>
              <div>
                <span className="font-semibold">{digest.total_follow_ups_needed}</span>{" "}
                <span className="text-muted-foreground">follow-ups</span>
              </div>
              {pipelineValue != null && pipelineValue > 0 && (
                <div>
                  <span className="font-semibold">${(pipelineValue / 1000).toFixed(0)}K</span>{" "}
                  <span className="text-muted-foreground">pipeline</span>
                </div>
              )}
            </div>

            {/* Summary snippet */}
            {executiveSummary && (
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {executiveSummary}
              </p>
            )}

            <Link
              href="/digest"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View Full Digest
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              No digest available yet.
            </p>
            <Link
              href="/digest"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Generate Digest
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
