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
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    supabase
      .from("daily_digests")
      .select("digest_date, total_calls_logged, total_follow_ups_needed, key_highlights, generated_at")
      .eq("digest_date", dateStr)
      .single()
      .then(({ data }) => {
        setDigest(data || null);
        setLoading(false);
      });
  }, [isAdmin]);

  // Only visible to admin/manager users
  if (!isAdmin) return null;
  if (loading) return null;

  // Extract executive summary (text before first ## heading)
  const executiveSummary = digest?.key_highlights
    ? digest.key_highlights.split(/^## /m)[0].trim()
    : null;

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
              No digest generated for yesterday.
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
