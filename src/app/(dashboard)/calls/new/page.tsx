"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
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
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Phone,
  Plus,
} from "lucide-react";
import { VoiceRecorder } from "@/components/calls/voice-recorder";
import { useAuth } from "@/components/auth-provider";

const DRAFT_KEY = "allturf_call_log_draft";

interface DraftState {
  transcript: string;
  companyId: string;
  contactId: string;
  savedAt: number;
}

export default function NewCallLogPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const { profile } = useAuth();

  const [transcript, setTranscript] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);

  // Load companies list
  useEffect(() => {
    supabase
      .from("companies")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setCompanies(data);
      });
  }, [supabase]);

  // Load contacts for selected company (or all if none selected)
  useEffect(() => {
    let query = supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .order("last_name");

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    query.then(({ data }) => {
      if (data) setContacts(data);
    });
  }, [supabase, companyId]);

  // Restore draft from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft: DraftState = JSON.parse(raw);
        // Only restore if less than 24 hours old
        if (Date.now() - draft.savedAt < 86400000) {
          setTranscript(draft.transcript);
          setCompanyId(draft.companyId);
          setContactId(draft.contactId);
          if (draft.companyId || draft.contactId) setShowOptional(true);
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!transcript && !companyId && !contactId) return;
    const timer = setTimeout(() => {
      try {
        const draft: DraftState = {
          transcript,
          companyId,
          contactId,
          savedAt: Date.now(),
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // ignore quota errors
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [transcript, companyId, contactId]);

  const handleSubmit = useCallback(async () => {
    if (!transcript.trim() || !profile?.id) return;
    setSaving(true);

    const { data, error } = await supabase
      .from("call_logs")
      .insert({
        rep_id: profile.id,
        company_id: companyId || null,
        contact_id: contactId || null,
        input_type: "voice_dictation",
        raw_transcript: transcript.trim(),
        processing_status: "pending",
      })
      .select("id")
      .single();

    setSaving(false);

    if (!error && data) {
      localStorage.removeItem(DRAFT_KEY);
      setSaved(true);

      // Fire-and-forget: trigger AI processing pipeline
      fetch("/api/turf/process-call-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_log_id: data.id }),
      }).catch(() => {});
    }
  }, [transcript, companyId, contactId, profile, supabase]);

  const handleLogAnother = useCallback(() => {
    setTranscript("");
    setCompanyId("");
    setContactId("");
    setShowOptional(false);
    setSaved(false);
  }, []);

  // Success state
  if (saved) {
    return (
      <div className="page-enter flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-xl font-semibold">Call logged!</h2>
        <p className="text-sm text-muted-foreground text-center">
          AI will extract key details and generate follow-up suggestions.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mt-2">
          <Button
            onClick={handleLogAnother}
            className="flex-1 min-h-[48px] text-base gap-2"
          >
            <Plus className="h-5 w-5" />
            Log Another
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/calls")}
            className="flex-1 min-h-[48px] text-base"
          >
            View All Calls
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter space-y-5 max-w-lg mx-auto pb-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Log Call
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Dictate or type your call notes. AI handles the rest.
        </p>
      </div>

      {/* Voice recorder — primary action */}
      <div className="flex flex-col items-center py-4">
        <VoiceRecorder
          transcript={transcript}
          onTranscriptChange={setTranscript}
        />
      </div>

      {/* Transcript / notes area */}
      <div>
        <Label className="text-sm font-medium">Call Notes</Label>
        <Textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Your dictation appears here, or type notes directly..."
          rows={6}
          className="mt-1 text-base min-h-[120px]"
        />
        {transcript && (
          <p className="text-xs text-muted-foreground mt-1">
            {transcript.split(/\s+/).filter(Boolean).length} words
          </p>
        )}
      </div>

      {/* Optional fields — collapsible */}
      <button
        type="button"
        onClick={() => setShowOptional(!showOptional)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[48px] w-full"
      >
        {showOptional ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
        Optional: Tag a course or contact
      </button>

      {showOptional && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div>
            <Label className="text-sm font-medium">Course</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="mt-1 min-h-[48px] text-base">
                <SelectValue placeholder="Select course (optional)..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none" className="min-h-[48px] text-base">
                  None
                </SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="min-h-[48px] text-base">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Contact</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger className="mt-1 min-h-[48px] text-base">
                <SelectValue placeholder="Select contact (optional)..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none" className="min-h-[48px] text-base">
                  None
                </SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="min-h-[48px] text-base">
                    {c.first_name} {c.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        disabled={!transcript.trim() || saving}
        className="w-full min-h-[52px] text-base gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <CheckCircle2 className="h-5 w-5" />
            Submit Call Log
          </>
        )}
      </Button>
    </div>
  );
}
