"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";

interface Commitment {
  id: string;
  description: string;
  deadline: string | null;
  company_name: string | null;
  status: "pending" | "due_today" | "overdue";
}

export function MyCommitmentsCard() {
  const { user } = useAuth();
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    async function load() {
      // Fetch extractions from this rep's calls that have action items
      const { data } = await supabase
        .from("call_log_extractions")
        .select(`
          id, action_items,
          call_log:call_logs!inner(rep_id, company:companies(name))
        `)
        .eq("call_log.rep_id", user!.id)
        .not("action_items", "is", null)
        .order("created_at", { ascending: false })
        .limit(30);

      const today = new Date().toISOString().split("T")[0];
      const items: Commitment[] = [];

      if (data) {
        for (const row of data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cl = row.call_log as any;
          const companyName = cl?.company?.name || null;
          const actionItems = row.action_items as Array<{
            type: string;
            description: string;
            due_date: string | null;
            priority: string | null;
            completed?: boolean;
          }> | null;

          if (!actionItems) continue;
          for (const ai of actionItems) {
            if (ai.completed) continue;
            let status: Commitment["status"] = "pending";
            if (ai.due_date) {
              if (ai.due_date < today) status = "overdue";
              else if (ai.due_date === today) status = "due_today";
            }
            items.push({
              id: `${row.id}-${ai.description.slice(0, 20)}`,
              description: ai.description,
              deadline: ai.due_date,
              company_name: companyName,
              status,
            });
          }
        }
      }

      // Sort: overdue first, then due_today, then pending
      const order: Record<string, number> = { overdue: 0, due_today: 1, pending: 2 };
      items.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

      setCommitments(items.slice(0, 8));
      setLoading(false);
    }
    load();
  }, [supabase, user]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (commitments.length === 0) return null;

  const overdueCount = commitments.filter((c) => c.status === "overdue").length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          My Open Commitments
          {overdueCount > 0 && (
            <Badge className="text-[10px] bg-red-100 text-red-700 ml-auto">
              {overdueCount} overdue
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {commitments.map((c) => (
          <div
            key={c.id}
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
              c.status === "overdue"
                ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                : c.status === "due_today"
                  ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
                  : ""
            }`}
          >
            <Clock className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
              c.status === "overdue" ? "text-red-500" :
              c.status === "due_today" ? "text-amber-500" :
              "text-muted-foreground"
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-muted-foreground">{c.description}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {c.company_name && (
                  <span className="text-[10px] text-muted-foreground">{c.company_name}</span>
                )}
                {c.deadline && (
                  <span className={`text-[10px] font-medium ${
                    c.status === "overdue" ? "text-red-600" :
                    c.status === "due_today" ? "text-amber-600" :
                    "text-muted-foreground"
                  }`}>
                    {c.status === "overdue" ? `Overdue (${c.deadline})` :
                     c.status === "due_today" ? "Due today" :
                     `Due ${c.deadline}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
