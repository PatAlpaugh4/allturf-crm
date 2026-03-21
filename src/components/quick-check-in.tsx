"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MapPin, CheckCircle2, Plus, Phone, X } from "lucide-react";
import {
  CONDITION_RATINGS,
  CONDITION_COLORS,
  type ConditionRating,
} from "@/lib/types";
import { PhotoCapture } from "@/components/photo-capture";
import { VoiceInput } from "@/components/voice-input";

export function QuickCheckInFab() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);

  return (
    <>
      {/* FAB menu — only visible on mobile/tablet viewports */}
      <div className="fixed bottom-6 right-6 z-50 flex md:hidden flex-col items-end gap-3">
        {/* Expanded menu items */}
        {menuOpen && (
          <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <a
              href="/calls/new"
              className="flex items-center gap-2 rounded-full bg-card border shadow-lg pl-4 pr-3 py-2.5 text-sm font-medium active:scale-95 transition-all min-h-[48px]"
            >
              <Phone className="h-4 w-4 text-primary" />
              Log Call
            </a>
            <button
              onClick={() => {
                setMenuOpen(false);
                setCheckInOpen(true);
              }}
              className="flex items-center gap-2 rounded-full bg-card border shadow-lg pl-4 pr-3 py-2.5 text-sm font-medium active:scale-95 transition-all min-h-[48px]"
            >
              <MapPin className="h-4 w-4 text-primary" />
              Quick Check-in
            </button>
          </div>
        )}

        {/* Main FAB button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl active:scale-95 transition-all ${
            menuOpen ? "rotate-45" : ""
          }`}
          aria-label="Quick actions"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>

      {/* Backdrop */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <Sheet open={checkInOpen} onOpenChange={setCheckInOpen}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Quick Visit Check-in
            </SheetTitle>
          </SheetHeader>
          <QuickCheckInForm onComplete={() => setCheckInOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function QuickCheckInForm({ onComplete }: { onComplete: () => void }) {
  const supabase = createBrowserClient();
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([]);
  const [courseId, setCourseId] = useState("");
  const [overall, setOverall] = useState<ConditionRating | "">("");
  const [greens, setGreens] = useState<ConditionRating | "">("");
  const [fairways, setFairways] = useState<ConditionRating | "">("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase
      .from("companies")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setCourses(data);
      });
  }, [supabase]);

  const handleSave = useCallback(async () => {
    if (!courseId) return;
    setSaving(true);

    const today = new Date().toISOString().split("T")[0];

    await supabase.from("visit_reports").insert({
      company_id: courseId,
      visit_date: today,
      overall_condition: overall || null,
      greens_condition: greens || null,
      fairways_condition: fairways || null,
      observations: notes || null,
      photo_urls: photos.length > 0 ? photos.map((f) => f.name) : null,
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      onComplete();
      // Reset for next use
      setSaved(false);
      setCourseId("");
      setOverall("");
      setGreens("");
      setFairways("");
      setNotes("");
      setPhotos([]);
    }, 1200);
  }, [courseId, overall, greens, fairways, notes, photos, supabase, onComplete]);

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <p className="text-lg font-medium">Check-in saved!</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-5">
      {/* Course selection — large touch target */}
      <div>
        <Label className="text-sm font-medium">Course</Label>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger className="mt-1 min-h-[44px] text-base">
            <SelectValue placeholder="Select course..." />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id} className="min-h-[44px] text-base">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Condition ratings — large toggle buttons */}
      <div>
        <Label className="text-sm font-medium">Overall Condition</Label>
        <MobileConditionToggle value={overall} onChange={setOverall} />
      </div>

      <div>
        <Label className="text-sm font-medium">Greens</Label>
        <MobileConditionToggle value={greens} onChange={setGreens} />
      </div>

      <div>
        <Label className="text-sm font-medium">Fairways</Label>
        <MobileConditionToggle value={fairways} onChange={setFairways} />
      </div>

      {/* Notes with voice input */}
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Quick Notes</Label>
          <VoiceInput
            onTranscript={(text) => setNotes((prev) => (prev ? `${prev} ${text}` : text))}
          />
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Tap mic or type observations..."
          rows={3}
          className="mt-1 text-base min-h-[88px]"
        />
      </div>

      {/* Photo capture */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Photos</Label>
        <PhotoCapture photos={photos} onPhotosChange={setPhotos} />
      </div>

      {/* Save button — full width, large */}
      <Button
        onClick={handleSave}
        disabled={!courseId || saving}
        className="w-full min-h-[48px] text-base gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <CheckCircle2 className="h-5 w-5" />
            Save Check-in
          </>
        )}
      </Button>
    </div>
  );
}

function MobileConditionToggle({
  value,
  onChange,
}: {
  value: ConditionRating | "";
  onChange: (val: ConditionRating | "") => void;
}) {
  return (
    <div className="flex gap-1.5 mt-1.5 flex-wrap">
      {CONDITION_RATINGS.map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange(value === rating ? "" : rating)}
          className={`px-3 py-2.5 text-sm rounded-lg border transition-colors min-h-[44px] font-medium ${
            value === rating
              ? CONDITION_COLORS[rating]
              : "bg-muted/50 text-muted-foreground hover:bg-muted active:bg-muted"
          }`}
        >
          {rating}
        </button>
      ))}
    </div>
  );
}
