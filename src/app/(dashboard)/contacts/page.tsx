"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Search,
  Loader2,
  Plus,
  ChevronRight,
  ChevronLeft,
  Phone,
  Mail,
  MessageSquare,
  Pencil,
  Clock,
  AlertCircle,
  CheckSquare,
} from "lucide-react";
import {
  CONTACT_STATUSES,
  CONTACT_ROLES,
  STATUS_COLORS,
  type ContactStatus,
  type Contact,
  type Activity,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContactCompany {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
}

interface ContactRow extends Omit<Contact, "company"> {
  company: ContactCompany | null;
}

interface CompanyOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

const PREFERRED_METHOD_ICON: Record<string, typeof Phone> = {
  phone: Phone,
  email: Mail,
  text: MessageSquare,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeDate(iso: string | null): string {
  if (!iso) return "—";
  const now = new Date();
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    if (absDays === 1) return "Tomorrow";
    if (absDays < 7) return `In ${absDays} days`;
    return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  }
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date(new Date().toDateString());
}

function formatFollowUp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date(new Date().toDateString());
  const diffDays = Math.floor((d.getTime() - now.getTime()) / 86_400_000);
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} days`;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContactsPage() {
  const supabase = createBrowserClient();

  // Data state
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  // Pagination
  const [page, setPage] = useState(1);

  // Selection for bulk actions
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Detail sheet
  const [selectedContact, setSelectedContact] = useState<ContactRow | null>(null);

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRow | null>(null);

  // Bulk status change
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkLoading, setBulkLoading] = useState(false);

  // ------ Data loading ------

  const loadContacts = useCallback(async () => {
    const { data } = await supabase
      .from("contacts")
      .select("*, company:companies(id, name, city, province)")
      .order("last_name")
      .order("first_name");

    if (data) setContacts(data as ContactRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // ------ Filtering ------

  const filtered = contacts.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (roleFilter !== "all" && c.role !== roleFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    return (
      fullName.includes(q) ||
      (c.company?.name && c.company.name.toLowerCase().includes(q)) ||
      (c.company?.city && c.company.city.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  // ------ Pagination ------

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePageNum = Math.min(page, totalPages);
  const pageContacts = filtered.slice(
    (safePageNum - 1) * PAGE_SIZE,
    safePageNum * PAGE_SIZE
  );

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, roleFilter]);

  // ------ Selection helpers ------

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === pageContacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pageContacts.map((c) => c.id)));
    }
  };

  // ------ Bulk status change ------

  const handleBulkStatusChange = async () => {
    if (!bulkStatus || selected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selected);
    await supabase
      .from("contacts")
      .update({ status: bulkStatus })
      .in("id", ids);
    setBulkLoading(false);
    setBulkStatus("");
    setSelected(new Set());
    loadContacts();
  };

  // ------ CSV export ------

  const handleExportCSV = () => {
    const rows = filtered.filter((c) => selected.size === 0 || selected.has(c.id));
    const header = "Name,Email,Phone,Role,Status,Course,City\n";
    const csv = rows.map((c) =>
      [
        `"${c.first_name} ${c.last_name}"`,
        c.email || "",
        c.phone || "",
        c.role || "",
        c.status,
        c.company?.name || "",
        c.company?.city || "",
      ].join(",")
    ).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ------ Row click ------

  const handleRowClick = (c: ContactRow) => {
    setSelectedContact(c);
  };

  // ------ Open add/edit dialog ------

  const openAddDialog = () => {
    setEditingContact(null);
    setDialogOpen(true);
  };

  const openEditDialog = (c: ContactRow) => {
    setEditingContact(c);
    setDialogOpen(true);
  };

  // ------ After save in dialog ------

  const handleDialogSaved = () => {
    setDialogOpen(false);
    setEditingContact(null);
    loadContacts();
    // Refresh the detail sheet if editing the currently-selected contact
    if (editingContact && selectedContact && editingContact.id === selectedContact.id) {
      // Re-fetch the single contact for the sheet
      supabase
        .from("contacts")
        .select("*, company:companies(id, name, city, province)")
        .eq("id", editingContact.id)
        .single()
        .then(({ data, error }) => {
          if (error) console.error("Failed to refresh contact:", error);
          else if (data) setSelectedContact(data as ContactRow);
        });
    }
  };

  return (
    <div className="page-enter space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Contacts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} contact{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={openAddDialog}>
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, course, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {CONTACT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {CONTACT_ROLES.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-accent/30 px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Separator orientation="vertical" className="h-5" />
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Change status" />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={!bulkStatus || bulkLoading}
            onClick={handleBulkStatusChange}
          >
            {bulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleExportCSV}>
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs ml-auto"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all contacts"
                      className="h-4 w-4 rounded border-muted-foreground/30"
                      checked={pageContacts.length > 0 && selected.size === pageContacts.length}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Role</TableHead>
                  <TableHead className="hidden md:table-cell">Course</TableHead>
                  <TableHead className="hidden lg:table-cell">City</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Contacted</TableHead>
                  <TableHead className="hidden md:table-cell">Follow-up</TableHead>
                  <TableHead className="hidden xl:table-cell w-10">Pref</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageContacts.map((c) => {
                  const overdue = isOverdue(c.next_follow_up);
                  const MethodIcon = c.preferred_contact_method
                    ? PREFERRED_METHOD_ICON[c.preferred_contact_method.toLowerCase()] || null
                    : null;

                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-accent/50 active:bg-accent/70"
                      onClick={() => handleRowClick(c)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${c.first_name} ${c.last_name}`}
                          className="h-4 w-4 rounded border-muted-foreground/30"
                          checked={selected.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">
                          {c.first_name} {c.last_name}
                        </p>
                        {/* Mobile-only: show role & status */}
                        <div className="flex gap-1.5 mt-0.5 sm:hidden">
                          {c.role && (
                            <span className="text-[11px] text-muted-foreground">{c.role}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {c.role || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {c.company ? (
                          <Link
                            href={`/courses/${c.company.id}`}
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {c.company.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {c.company?.city || "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge className={`text-[10px] h-5 ${STATUS_COLORS[c.status as ContactStatus] || ""}`}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {relativeDate(c.last_contacted_at)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        <span className={overdue ? "font-medium text-destructive" : "text-muted-foreground"}>
                          {overdue && <AlertCircle className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}
                          {formatFollowUp(c.next_follow_up)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {MethodIcon ? (
                          <MethodIcon className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No contacts found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-sm text-muted-foreground">
                Page {safePageNum} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePageNum <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePageNum >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selectedContact} onOpenChange={(open) => !open && setSelectedContact(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Contact Details
            </SheetTitle>
            <SheetDescription className="sr-only">
              View and manage contact information
            </SheetDescription>
          </SheetHeader>
          {selectedContact && (
            <ContactDetail
              contact={selectedContact}
              onEdit={() => openEditDialog(selectedContact)}
              onNotesUpdated={(notes) => {
                setSelectedContact({ ...selectedContact, notes });
                loadContacts();
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Add/Edit Dialog */}
      <ContactFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editingContact}
        onSaved={handleDialogSaved}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contact Detail (Sheet panel)
// ---------------------------------------------------------------------------

function ContactDetail({
  contact,
  onEdit,
  onNotesUpdated,
}: {
  contact: ContactRow;
  onEdit: () => void;
  onNotesUpdated: (notes: string) => void;
}) {
  const supabase = createBrowserClient();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [deals, setDeals] = useState<Array<{ id: string; name: string; stage: string; value_cad: number }>>([]);
  const [callSummaries, setCallSummaries] = useState<Array<{ id: string; created_at: string; summary: string | null }>>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [notes, setNotes] = useState(contact.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    setNotes(contact.notes || "");
  }, [contact.notes]);

  useEffect(() => {
    async function load() {
      setLoadingTimeline(true);
      const [actRes, dealRes, callRes] = await Promise.all([
        supabase
          .from("activities")
          .select("id, type, summary, created_at")
          .eq("contact_id", contact.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("deals")
          .select("id, name, stage, value_cad")
          .eq("contact_id", contact.id)
          .not("stage", "in", '("Paid","Closed Lost")'),
        supabase
          .from("call_logs")
          .select("id, created_at, extraction:call_log_extractions(summary)")
          .eq("contact_id", contact.id)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      if (actRes.data) setActivities(actRes.data as Activity[]);
      if (dealRes.data) setDeals(dealRes.data);
      if (callRes.data) {
        setCallSummaries(
          callRes.data.map((cl: Record<string, unknown>) => {
            const ext = cl.extraction as Record<string, unknown> | Array<Record<string, unknown>> | null;
            const summary = Array.isArray(ext)
              ? (ext[0]?.summary as string | null) ?? null
              : (ext?.summary as string | null) ?? null;
            return { id: cl.id as string, created_at: cl.created_at as string, summary };
          })
        );
      }
      setLoadingTimeline(false);
    }
    load();
  }, [supabase, contact.id]);

  const handleNoteBlur = async () => {
    if (notes === (contact.notes || "")) return;
    setSavingNotes(true);
    await supabase.from("contacts").update({ notes }).eq("id", contact.id);
    setSavingNotes(false);
    onNotesUpdated(notes);
  };

  const logPhoneActivity = async () => {
    await supabase.from("activities").insert({
      contact_id: contact.id,
      type: "Phone Call",
      summary: `Outbound call to ${contact.first_name} ${contact.last_name}`,
    });
    await supabase
      .from("contacts")
      .update({ last_contacted_at: new Date().toISOString() })
      .eq("id", contact.id);
    // Refresh activities
    const { data } = await supabase
      .from("activities")
      .select("id, type, summary, created_at")
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setActivities(data as Activity[]);
  };

  const overdue = isOverdue(contact.next_follow_up);

  return (
    <div className="mt-4 space-y-5">
      {/* Header info */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-semibold">
              {contact.first_name} {contact.last_name}
            </p>
            {contact.role && (
              <p className="text-sm text-muted-foreground">{contact.role}</p>
            )}
          </div>
          <Badge className={STATUS_COLORS[contact.status as ContactStatus] || ""}>
            {contact.status}
          </Badge>
        </div>
        {contact.company && (
          <Link
            href={`/courses/${contact.company.id}`}
            className="text-sm text-primary hover:underline"
          >
            {contact.company.name}
            {contact.company.city && `, ${contact.company.city}`}
          </Link>
        )}
      </div>

      <Separator />

      {/* Contact info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Email</p>
          {contact.email ? (
            <a href={`mailto:${contact.email}`} className="text-primary hover:underline break-all">
              {contact.email}
            </a>
          ) : (
            <p>—</p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground">Phone</p>
          {contact.phone ? (
            <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
              {contact.phone}
            </a>
          ) : (
            <p>—</p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground">Preferred</p>
          <p className="capitalize">{contact.preferred_contact_method || "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Follow-up</p>
          <p className={overdue ? "font-medium text-destructive" : ""}>
            {overdue && <AlertCircle className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}
            {formatFollowUp(contact.next_follow_up)}
          </p>
        </div>
      </div>

      <Separator />

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={logPhoneActivity}>
          <Phone className="h-3.5 w-3.5" />
          Call
        </Button>
        {contact.email && (
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <a href={`mailto:${contact.email}`}>
              <Mail className="h-3.5 w-3.5" />
              Email
            </a>
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </div>

      <Separator />

      {/* Notes */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="text-sm font-medium">Notes</h3>
          {savingNotes && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder="Add notes about this contact..."
          className="min-h-[80px] text-sm"
        />
      </div>

      <Separator />

      {/* Activity timeline */}
      <div>
        <h3 className="text-sm font-medium mb-2">Activity Timeline</h3>
        {loadingTimeline ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No activities yet</p>
        ) : (
          <div className="space-y-2">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 text-sm">
                <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-xs text-muted-foreground">
                    {a.type} · {relativeDate(a.created_at)}
                  </p>
                  {a.summary && (
                    <p className="text-sm truncate">{a.summary}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent call summaries */}
      {callSummaries.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-medium mb-2">Recent Call Summaries</h3>
            <div className="space-y-2">
              {callSummaries.map((cs) => (
                <div key={cs.id} className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">
                    {relativeDate(cs.created_at)}
                  </p>
                  <p>{cs.summary || "No summary"}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Open deals */}
      {deals.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-medium mb-2">Open Deals</h3>
            <div className="space-y-1.5">
              {deals.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate max-w-[200px]">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">${d.value_cad.toLocaleString()}</span>
                    <Badge variant="outline" className="text-[10px] h-4">{d.stage}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contact Form Dialog (Add / Edit)
// ---------------------------------------------------------------------------

function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ContactRow | null;
  onSaved: () => void;
}) {
  const supabase = createBrowserClient();
  const isEdit = !!contact;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<string>("");
  const [status, setStatus] = useState<string>("New");
  const [preferredMethod, setPreferredMethod] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [formNotes, setFormNotes] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load companies for the combobox
  useEffect(() => {
    if (!open) return;
    supabase
      .from("companies")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setCompanies(data);
      });
  }, [open, supabase]);

  // Populate form when editing
  useEffect(() => {
    if (contact) {
      setFirstName(contact.first_name);
      setLastName(contact.last_name);
      setEmail(contact.email || "");
      setPhone(contact.phone || "");
      setRole(contact.role || "");
      setStatus(contact.status);
      setPreferredMethod(contact.preferred_contact_method || "");
      setCompanyId(contact.company_id || "");
      setFormNotes(contact.notes || "");
      setNextFollowUp(contact.next_follow_up || "");
    } else {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setRole("");
      setStatus("New");
      setPreferredMethod("");
      setCompanyId("");
      setFormNotes("");
      setNextFollowUp("");
    }
    setError("");
  }, [contact, open]);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }
    if (!companyId) {
      setError("Please select a company.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      role: role || null,
      status,
      preferred_contact_method: preferredMethod || null,
      company_id: companyId || null,
      notes: formNotes.trim() || null,
      next_follow_up: nextFollowUp || null,
    };

    if (isEdit) {
      const { error: err } = await supabase
        .from("contacts")
        .update(payload)
        .eq("id", contact!.id);
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: err } = await supabase
        .from("contacts")
        .insert(payload);
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSaved();
  };

  const filteredCompanies = companySearch
    ? companies.filter((co) => co.name.toLowerCase().includes(companySearch.toLowerCase()))
    : companies;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Contact" : "Add Contact"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update contact information." : "Add a new contact to the CRM."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cf-first">First Name *</Label>
              <Input id="cf-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-last">Last Name *</Label>
              <Input id="cf-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cf-email">Email</Label>
            <Input id="cf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cf-phone">Phone</Label>
            <Input id="cf-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Company *</Label>
            <div className="space-y-1">
              <Input
                placeholder="Search companies..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
              />
              <div className="max-h-32 overflow-y-auto rounded-md border">
                {filteredCompanies.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">No companies found</p>
                ) : (
                  filteredCompanies.map((co) => (
                    <button
                      key={co.id}
                      type="button"
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors ${
                        companyId === co.id ? "bg-primary/10 text-primary font-medium" : ""
                      }`}
                      onClick={() => {
                        setCompanyId(co.id);
                        setCompanySearch("");
                      }}
                    >
                      {co.name}
                    </button>
                  ))
                )}
              </div>
              {companyId && (
                <p className="text-xs text-muted-foreground">
                  Selected: {companies.find((co) => co.id === companyId)?.name}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Preferred Contact Method</Label>
            <Select value={preferredMethod} onValueChange={setPreferredMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Phone">Phone</SelectItem>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="Text">Text</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cf-followup">Next Follow-up</Label>
            <Input
              id="cf-followup"
              type="date"
              value={nextFollowUp}
              onChange={(e) => setNextFollowUp(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cf-notes">Notes</Label>
            <Textarea
              id="cf-notes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="min-h-[60px]"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Save Changes" : "Add Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
