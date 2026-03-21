"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Bell, Loader2 } from "lucide-react";

interface Nudge {
  id: string;
  nudge_type: string;
  priority: string;
  title: string;
  message: string;
  created_at: string;
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-400",
  low: "bg-gray-400",
};

export function MyNudgesCard() {
  const { user } = useAuth();
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    async function load() {
      const { data } = await supabase
        .from("rep_nudges")
        .select("id, nudge_type, priority, title, message, created_at")
        .eq("rep_id", user!.id)
        .eq("is_dismissed", false)
        .eq("is_completed", false)
        .order("created_at", { ascending: false })
        .limit(5);

      if (data) {
        // Sort by priority: urgent > high > medium > low
        const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        data.sort((a, b) => (order[a.priority] ?? 4) - (order[b.priority] ?? 4));
        setNudges(data as Nudge[]);
      }
      setLoading(false);
    }
    load();
  }, [supabase, user]);

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          My Nudges
          {!loading && nudges.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-auto">{nudges.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : nudges.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            All caught up — no pending nudges
          </p>
        ) : (
          <div className="space-y-2">
            {nudges.map((nudge) => (
              <div key={nudge.id} className="flex items-start gap-2.5 rounded-lg border p-2.5">
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[nudge.priority] || PRIORITY_DOT.medium}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{nudge.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{nudge.message}</p>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(nudge.created_at)}</span>
                </div>
              </div>
            ))}
            <Link
              href="/nudges"
              className="flex items-center justify-center gap-1 pt-1 text-xs text-primary hover:underline"
            >
              See all nudges
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
