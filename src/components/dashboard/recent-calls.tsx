"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, ArrowRight, Loader2 } from "lucide-react";
import {
  SENTIMENT_COLORS,
  type Sentiment,
  type ProcessingStatus,
} from "@/lib/types";

const STATUS_BADGE_COLORS: Record<ProcessingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

interface RecentCall {
  id: string;
  created_at: string;
  processing_status: ProcessingStatus;
  company: { name: string } | null;
  rep: { full_name: string | null } | null;
  extraction: {
    summary: string | null;
    sentiment: Sentiment | null;
  } | null;
}

export function RecentCallsCard() {
  const [calls, setCalls] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("call_logs")
        .select(
          `id, created_at, processing_status,
           company:companies(name),
           rep:user_profiles(full_name),
           extraction:call_log_extractions(summary, sentiment)`
        )
        .order("created_at", { ascending: false })
        .limit(5);

      if (data) setCalls(data as unknown as RecentCall[]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary" />
          Recent Calls
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : calls.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No call logs yet
          </p>
        ) : (
          <div className="space-y-2">
            {calls.map((call) => (
              <div
                key={call.id}
                className="flex items-start gap-3 rounded-lg border p-2.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {call.company?.name || "Unknown course"}
                    </p>
                    <Badge
                      className={`text-[9px] h-4 shrink-0 ${STATUS_BADGE_COLORS[call.processing_status]}`}
                    >
                      {call.processing_status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {call.extraction?.summary || "Processing..."}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {call.rep?.full_name || "Unknown"} · {timeAgo(call.created_at)}
                    </span>
                    {call.extraction?.sentiment && (
                      <Badge
                        className={`text-[9px] h-3.5 ${SENTIMENT_COLORS[call.extraction.sentiment]}`}
                      >
                        {call.extraction.sentiment}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <Link
              href="/calls"
              className="flex items-center justify-center gap-1 pt-1 text-xs text-primary hover:underline"
            >
              View all calls
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
