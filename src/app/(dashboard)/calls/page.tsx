"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Phone,
  Plus,
  Search,
} from "lucide-react";
import {
  PROCESSING_STATUSES,
  SENTIMENT_COLORS,
  NUDGE_TYPE_COLORS,
  type Sentiment,
  type ProcessingStatus,
  type NudgeType,
} from "@/lib/types";

const STATUS_BADGE_COLORS: Record<ProcessingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

interface CallLogRow {
  id: string;
  created_at: string;
  input_type: string;
  raw_transcript: string | null;
  processing_status: ProcessingStatus;
  duration_seconds: number | null;
  company: { id: string; name: string; city: string | null } | null;
  contact: { id: string; first_name: string; last_name: string } | null;
  rep: { id: string; full_name: string | null } | null;
  extraction: {
    summary: string | null;
    sentiment: Sentiment | null;
    diseases_mentioned: string[] | null;
    products_mentioned: string[] | null;
    key_topics: string[] | null;
    follow_up_needed: boolean;
    follow_up_date: string | null;
    action_items: Array<{ type: string; description: string; completed: boolean }> | null;
    confidence_score: number | null;
  } | null;
  nudges: Array<{
    id: string;
    nudge_type: NudgeType;
    priority: string;
    title: string;
    message: string | null;
    is_dismissed: boolean;
    is_completed: boolean;
  }>;
}

export default function CallLogsPage() {
  const [logs, setLogs] = useState<CallLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<CallLogRow | null>(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from("call_logs")
      .select(`
        *,
        company:companies(id, name, city),
        contact:contacts(id, first_name, last_name),
        rep:user_profiles(id, full_name),
        extraction:call_log_extractions(*),
        nudges:rep_nudges(id, nudge_type, priority, title, message, is_dismissed, is_completed)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (data) setLogs(data as unknown as CallLogRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Poll every 5s while any logs are pending/processing
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const hasPending = logs.some(
      (l) => l.processing_status === "pending" || l.processing_status === "processing"
    );

    if (hasPending && !pollingRef.current) {
      pollingRef.current = setInterval(loadLogs, 5000);
    } else if (!hasPending && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [logs, loadLogs]);

  const filtered = logs.filter((log) => {
    if (statusFilter !== "all" && log.processing_status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.company?.name?.toLowerCase().includes(q) ||
      log.contact?.first_name?.toLowerCase().includes(q) ||
      log.contact?.last_name?.toLowerCase().includes(q) ||
      log.raw_transcript?.toLowerCase().includes(q) ||
      log.extraction?.summary?.toLowerCase().includes(q)
    );
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getSummaryPreview = (log: CallLogRow) => {
    if (log.extraction?.summary) return log.extraction.summary;
    if (log.raw_transcript) {
      return log.raw_transcript.length > 80
        ? log.raw_transcript.slice(0, 80) + "..."
        : log.raw_transcript;
    }
    return "No content";
  };

  return (
    <div className="page-enter space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Call Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} log{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2 min-h-[44px]"
          onClick={() => router.push("/calls/new")}
        >
          <Plus className="h-4 w-4" />
          Log Call
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by course, contact, or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-[44px]">All Statuses</SelectItem>
            {PROCESSING_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="min-h-[44px] capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="hidden sm:table-cell">Course</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Sentiment</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer hover:bg-accent/50 active:bg-accent/70"
                  onClick={() => setSelectedLog(log)}
                >
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {log.company?.name || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[250px]">
                      <p className="text-sm truncate">{getSummaryPreview(log)}</p>
                      {/* Mobile-only status badge */}
                      <div className="flex gap-1.5 mt-1 md:hidden">
                        <Badge className={`text-[10px] h-4 ${STATUS_BADGE_COLORS[log.processing_status]}`}>
                          {log.processing_status}
                        </Badge>
                        {log.extraction?.sentiment && (
                          <Badge className={`text-[10px] h-4 ${SENTIMENT_COLORS[log.extraction.sentiment]}`}>
                            {log.extraction.sentiment}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge className={`text-[10px] h-5 ${STATUS_BADGE_COLORS[log.processing_status]}`}>
                      {log.processing_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {log.extraction?.sentiment ? (
                      <Badge className={`text-[10px] h-5 ${SENTIMENT_COLORS[log.extraction.sentiment]}`}>
                        {log.extraction.sentiment}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No call logs found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail sheet */}
      <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Call Details
            </SheetTitle>
          </SheetHeader>
          {selectedLog && <CallLogDetail log={selectedLog} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CallLogDetail({ log }: { log: CallLogRow }) {
  return (
    <div className="mt-4 space-y-5">
      {/* Meta */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Date</p>
          <p className="font-medium">
            {new Date(log.created_at).toLocaleDateString("en-CA", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Status</p>
          <Badge className={`mt-0.5 ${STATUS_BADGE_COLORS[log.processing_status]}`}>
            {log.processing_status}
          </Badge>
        </div>
        {log.company && (
          <div>
            <p className="text-muted-foreground">Course</p>
            <p className="font-medium">{log.company.name}</p>
          </div>
        )}
        {log.contact && (
          <div>
            <p className="text-muted-foreground">Contact</p>
            <p className="font-medium">
              {log.contact.first_name} {log.contact.last_name}
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* Raw transcript */}
      <div>
        <h3 className="text-sm font-medium mb-1.5">Raw Notes</h3>
        <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">
          {log.raw_transcript || "No content"}
        </div>
      </div>

      {/* AI Extraction */}
      {log.extraction && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-medium">AI Extraction</h3>

            {log.extraction.summary && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Summary</p>
                <p className="text-sm">{log.extraction.summary}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {log.extraction.sentiment && (
                <Badge className={SENTIMENT_COLORS[log.extraction.sentiment]}>
                  {log.extraction.sentiment}
                </Badge>
              )}
              {log.extraction.follow_up_needed && (
                <Badge className="bg-orange-100 text-orange-700">
                  Follow-up needed
                  {log.extraction.follow_up_date && ` by ${log.extraction.follow_up_date}`}
                </Badge>
              )}
              {log.extraction.confidence_score != null && (
                <Badge variant="outline">
                  {Math.round(log.extraction.confidence_score * 100)}% confidence
                </Badge>
              )}
            </div>

            {log.extraction.diseases_mentioned && log.extraction.diseases_mentioned.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Diseases Mentioned</p>
                <div className="flex flex-wrap gap-1.5">
                  {log.extraction.diseases_mentioned.map((d) => (
                    <Badge key={d} variant="outline" className="text-xs">
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {log.extraction.products_mentioned && log.extraction.products_mentioned.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Products Mentioned</p>
                <div className="flex flex-wrap gap-1.5">
                  {log.extraction.products_mentioned.map((p) => (
                    <Badge key={p} variant="outline" className="text-xs">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {log.extraction.key_topics && log.extraction.key_topics.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Key Topics</p>
                <div className="flex flex-wrap gap-1.5">
                  {log.extraction.key_topics.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {log.extraction.action_items && log.extraction.action_items.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Action Items</p>
                <ul className="space-y-1">
                  {log.extraction.action_items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${item.completed ? "bg-green-100 border-green-300" : "border-muted-foreground/30"}`}>
                        {item.completed && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                      </span>
                      <span className={item.completed ? "line-through text-muted-foreground" : ""}>
                        {item.description}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}

      {/* Nudges */}
      {log.nudges && log.nudges.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium">AI Suggestions</h3>
            {log.nudges.map((nudge) => (
              <div
                key={nudge.id}
                className={`rounded-lg border p-3 space-y-1 ${
                  nudge.is_completed
                    ? "opacity-60"
                    : nudge.is_dismissed
                    ? "opacity-40"
                    : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] ${NUDGE_TYPE_COLORS[nudge.nudge_type]}`}>
                    {nudge.nudge_type.replace(/_/g, " ")}
                  </Badge>
                  {nudge.is_completed && (
                    <Badge className="text-[10px] bg-green-100 text-green-700">done</Badge>
                  )}
                </div>
                <p className="text-sm font-medium">{nudge.title}</p>
                {nudge.message && (
                  <p className="text-xs text-muted-foreground">{nudge.message}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  );
}
