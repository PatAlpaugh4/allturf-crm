"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, MinusCircle, Users } from "lucide-react";

interface RepRow {
  id: string;
  full_name: string | null;
  territory: string | null;
  calls_today: number;
  last_call_time: string | null;
  active_nudges: number;
}

export function RepActivitySnapshot() {
  const [reps, setReps] = useState<RepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      // Get all active reps
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name, territory")
        .eq("is_active", true);

      if (!profiles) { setLoading(false); return; }

      // Today's calls
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: todayCalls } = await supabase
        .from("call_logs")
        .select("rep_id, created_at")
        .gte("created_at", todayStart.toISOString());

      // Count calls per rep and track latest call time
      const callData = new Map<string, { count: number; latest: string }>();
      if (todayCalls) {
        for (const call of todayCalls) {
          const existing = callData.get(call.rep_id);
          if (existing) {
            existing.count++;
            if (call.created_at > existing.latest) existing.latest = call.created_at;
          } else {
            callData.set(call.rep_id, { count: 1, latest: call.created_at });
          }
        }
      }

      // Active nudges per rep
      const { data: nudgeCounts } = await supabase
        .from("rep_nudges")
        .select("rep_id")
        .eq("is_dismissed", false)
        .eq("is_completed", false);

      const nudgeMap = new Map<string, number>();
      if (nudgeCounts) {
        for (const n of nudgeCounts) {
          nudgeMap.set(n.rep_id, (nudgeMap.get(n.rep_id) || 0) + 1);
        }
      }

      const repRows: RepRow[] = profiles.map((p) => {
        const cd = callData.get(p.id);
        return {
          id: p.id,
          full_name: p.full_name,
          territory: p.territory,
          calls_today: cd?.count || 0,
          last_call_time: cd?.latest || null,
          active_nudges: nudgeMap.get(p.id) || 0,
        };
      });

      // Sort: active reps first (by calls desc), then inactive
      repRows.sort((a, b) => {
        if (a.calls_today === 0 && b.calls_today > 0) return 1;
        if (a.calls_today > 0 && b.calls_today === 0) return -1;
        return b.calls_today - a.calls_today;
      });

      setReps(repRows);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const activeCount = reps.filter((r) => r.calls_today > 0).length;

  const timeStr = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Rep Activity Today
          {!loading && (
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {activeCount}/{reps.length} active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : reps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No reps found</p>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-1.5 pr-2 font-medium">Rep</th>
                  <th className="text-right py-1.5 px-2 font-medium">Calls</th>
                  <th className="text-right py-1.5 px-2 font-medium hidden sm:table-cell">Last Call</th>
                  <th className="text-right py-1.5 pl-2 font-medium">Nudges</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((rep) => (
                  <tr
                    key={rep.id}
                    className={`border-b last:border-b-0 ${rep.calls_today === 0 ? "text-muted-foreground" : ""}`}
                  >
                    <td className="py-1.5 pr-2">
                      <div className="flex items-center gap-1.5">
                        {rep.calls_today > 0 ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        ) : (
                          <MinusCircle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                        )}
                        <span className="truncate max-w-[140px]">{rep.full_name || "Unknown"}</span>
                        {rep.territory && (
                          <span className="text-[10px] text-muted-foreground hidden md:inline">
                            {rep.territory}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right font-medium">
                      {rep.calls_today || "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right text-xs hidden sm:table-cell">
                      {timeStr(rep.last_call_time)}
                    </td>
                    <td className="py-1.5 pl-2 text-right">
                      {rep.active_nudges > 0 ? (
                        <Badge variant="secondary" className="text-[10px] h-4">
                          {rep.active_nudges}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
