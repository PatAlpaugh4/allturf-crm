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
import {
  AlertCircle,
  Users,
  Search,
  Loader2,
  Plus,
  Phone,
  Mail,
  X,
} from "lucide-react";
import { CONTACT_ROLES, type Contact } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContactCompany {
  id: string;
  name: string;
}

interface ContactRow extends Omit<Contact, "company"> {
  company: ContactCompany | null;
}

interface CompanyOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContactsPage() {
  const supabase = createBrowserClient();

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Detail sheet
  const [selectedContact, setSelectedContact] = useState<ContactRow | null>(
    null
  );

  // Add dialog
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadContacts = useCallback(async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("contacts")
        .select("*, company:companies(id, name)")
        .order("last_name")
        .order("first_name");

      if (fetchError) throw fetchError;
      if (data) setContacts(data as ContactRow[]);
      setLoading(false);
    } catch {
      setError("Failed to load contacts. Please try again.");
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Client-side search
  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    return (
      fullName.includes(q) ||
      (c.company?.name && c.company.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const handleDialogSaved = () => {
    setDialogOpen(false);
    loadContacts();
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
        <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button size="sm" variant="outline" onClick={() => loadContacts()}>Retry</Button>
          <button onClick={() => setError(null)} className="text-destructive/60 hover:text-destructive"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, course, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
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
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => setSelectedContact(c)}
                >
                  <TableCell className="font-medium">
                    {c.first_name} {c.last_name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.role || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
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
                  <TableCell className="text-sm">
                    {c.phone ? (
                      <a
                        href={`tel:${c.phone}`}
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {c.email ? (
                      <a
                        href={`mailto:${c.email}`}
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No contacts found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet
        open={!!selectedContact}
        onOpenChange={(open) => !open && setSelectedContact(null)}
      >
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Contact Info
            </SheetTitle>
            <SheetDescription className="sr-only">
              Contact details
            </SheetDescription>
          </SheetHeader>
          {selectedContact && (
            <ContactDetail
              contact={selectedContact}
              onNotesUpdated={(notes) => {
                setSelectedContact({ ...selectedContact, notes });
                loadContacts();
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Add Contact Dialog */}
      <ContactFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={handleDialogSaved}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contact Detail (simple info card)
// ---------------------------------------------------------------------------

function ContactDetail({
  contact,
  onNotesUpdated,
}: {
  contact: ContactRow;
  onNotesUpdated: (notes: string) => void;
}) {
  const supabase = createBrowserClient();
  const [notes, setNotes] = useState(contact.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    setNotes(contact.notes || "");
  }, [contact.notes]);

  const handleNoteBlur = async () => {
    if (notes === (contact.notes || "")) return;
    setSavingNotes(true);
    await supabase.from("contacts").update({ notes }).eq("id", contact.id);
    setSavingNotes(false);
    onNotesUpdated(notes);
  };

  return (
    <div className="mt-4 space-y-5">
      {/* Name & role */}
      <div>
        <p className="text-lg font-semibold">
          {contact.first_name} {contact.last_name}
        </p>
        {contact.role && (
          <Badge variant="outline" className="mt-1">
            {contact.role}
          </Badge>
        )}
      </div>

      {/* Course link */}
      {contact.company && (
        <Link
          href={`/courses/${contact.company.id}`}
          className="block text-sm text-primary hover:underline"
        >
          {contact.company.name}
        </Link>
      )}

      {/* Contact info */}
      <div className="space-y-2.5 text-sm">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
          {contact.phone ? (
            <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
              {contact.phone}
            </a>
          ) : (
            <span className="text-muted-foreground">No phone</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="text-primary hover:underline break-all"
            >
              {contact.email}
            </a>
          ) : (
            <span className="text-muted-foreground">No email</span>
          )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="text-sm font-medium">Notes</h3>
          {savingNotes && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder="Add notes about this contact..."
          className="min-h-[80px] text-sm"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Contact Dialog (simplified)
// ---------------------------------------------------------------------------

function ContactFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const supabase = createBrowserClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load companies
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

  // Reset form on open
  useEffect(() => {
    if (open) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setRole("");
      setCompanyId("");
      setCompanySearch("");
      setError("");
    }
  }, [open]);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }
    if (!companyId) {
      setError("Please select a course.");
      return;
    }

    setSaving(true);
    setError("");

    const { error: err } = await supabase.from("contacts").insert({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      role: role || null,
      company_id: companyId,
      status: "Active",
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  };

  const filteredCompanies = companySearch
    ? companies.filter((co) =>
        co.name.toLowerCase().includes(companySearch.toLowerCase())
      )
    : companies;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
          <DialogDescription>
            Add a new contact to the directory.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cf-first">First Name *</Label>
              <Input
                id="cf-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-last">Last Name *</Label>
              <Input
                id="cf-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Course *</Label>
            <div className="space-y-1">
              <Input
                placeholder="Search courses..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
              />
              <div className="max-h-32 overflow-y-auto rounded-md border">
                {filteredCompanies.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">
                    No courses found
                  </p>
                ) : (
                  filteredCompanies.map((co) => (
                    <button
                      key={co.id}
                      type="button"
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors ${
                        companyId === co.id
                          ? "bg-primary/10 text-primary font-medium"
                          : ""
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
            <Label htmlFor="cf-phone">Phone</Label>
            <Input
              id="cf-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cf-email">Email</Label>
            <Input
              id="cf-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Add Contact"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
