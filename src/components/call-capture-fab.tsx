"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Mic, Square, Keyboard, Loader2, X, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";

export function CallCaptureFab() {
  const [open, setOpen] = useState(false);

  // Listen for custom event from CallCapturePrompt on dashboard
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-call-capture", handler);
    return () => window.removeEventListener("open-call-capture", handler);
  }, []);

  return (
    <>
      {/* FAB — fixed bottom-right */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 md:w-12 md:h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl active:scale-95 transition-all"
        aria-label="Log a call"
      >
        <Mic className="h-6 w-6 md:h-5 md:w-5" />
        {/* Subtle pulse ring when idle */}
        <span className="absolute inset-0 rounded-full animate-ping bg-primary/20 pointer-events-none" style={{ animationDuration: "3s" }} />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="h-[100dvh] sm:h-[85vh] sm:max-w-lg sm:mx-auto sm:rounded-t-2xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                Log Call
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </SheetTitle>
          </SheetHeader>
          {open && (
            <CallCaptureForm onComplete={() => setOpen(false)} />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function CallCaptureForm({ onComplete }: { onComplete: () => void }) {
  const { profile } = useAuth();
  const supabase = createBrowserClient();

  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [showTextarea, setShowTextarea] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [isSiteVisit, setIsSiteVisit] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef(transcript);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Detect browser support
  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    setSupported(!!SpeechRecognitionAPI);
    // If no speech support, default to textarea mode
    if (!SpeechRecognitionAPI) setShowTextarea(true);
  }, []);

  const startRecording = useCallback(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-CA";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalTranscript) {
        const separator = transcriptRef.current ? " " : "";
        const updated = transcriptRef.current + separator + finalTranscript;
        transcriptRef.current = updated;
        setTranscript(updated);
        setInterimText("");
      } else {
        setInterimText(interim);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      const errorCode: string = event.error || "unknown";
      const messages: Record<string, string> = {
        "not-allowed": "Microphone permission denied. Please allow access in browser settings.",
        "no-speech": "No speech detected. Try again.",
        "network": "Network error. Check your connection.",
        "aborted": "Recording interrupted.",
      };
      setErrorMessage(messages[errorCode] || `Error: ${errorCode}`);
      setRecording(false);
      setInterimText("");
    };

    recognition.onend = () => {
      // Auto-restart if still in recording mode (browser ~60s timeout)
      if (recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          setRecording(false);
          setInterimText("");
        }
        return;
      }
      setRecording(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
    setErrorMessage("");
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      ref.stop();
    }
    setRecording(false);
    setInterimText("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  const handleSave = useCallback(async () => {
    if (!transcript.trim() || !profile?.id) return;
    setSaving(true);

    // Stop recording if active
    if (recording) stopRecording();

    const inputType = isSiteVisit ? "site_visit" : showTextarea ? "typed" : "voice_dictation";

    const { data, error } = await supabase
      .from("call_logs")
      .insert({
        rep_id: profile.id,
        input_type: inputType,
        raw_transcript: transcript.trim(),
        processing_status: "pending",
      })
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      toast.error("Failed to save call log. Please try again.");
      return;
    }

    if (data) {
      toast.success("Call saved — AI is processing...");

      // Fire-and-forget: trigger AI processing
      fetch("/api/turf/process-call-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_log_id: data.id }),
      }).catch(() => {});

      onComplete();
    }
  }, [transcript, profile, supabase, recording, stopRecording, showTextarea, isSiteVisit, onComplete]);

  const wordCount = transcript.split(/\s+/).filter(Boolean).length;

  return (
    <div className="mt-4 flex flex-col gap-5 h-full">
      {/* Prompt */}
      <p className="text-sm text-muted-foreground text-center px-4">
        Dictate everything — contact, course, what you discussed, action items.
        AI will extract the details.
      </p>

      {/* Recording UI */}
      {!showTextarea && (
        <div className="flex flex-col items-center gap-4 py-4">
          {recording ? (
            <Button
              type="button"
              variant="destructive"
              onClick={stopRecording}
              className="w-20 h-20 rounded-full p-0 shadow-lg"
            >
              <Square className="h-8 w-8" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={startRecording}
              disabled={supported === false}
              className="w-20 h-20 rounded-full p-0 shadow-lg bg-primary hover:bg-primary/90"
            >
              <Mic className="h-8 w-8" />
            </Button>
          )}

          {/* Recording indicator */}
          {recording && (
            <div className="flex items-center gap-2 text-destructive">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
              </span>
              <span className="text-sm font-medium">Recording...</span>
            </div>
          )}

          {!recording && !transcript && (
            <p className="text-xs text-muted-foreground">
              Tap to start dictating
            </p>
          )}
        </div>
      )}

      {/* Live interim text */}
      {interimText && (
        <p className="text-sm text-muted-foreground italic text-center px-4">
          {interimText}
        </p>
      )}

      {/* Error message */}
      {errorMessage && (
        <p className="text-sm text-destructive text-center px-4">
          {errorMessage}
        </p>
      )}

      {/* Transcript display / textarea */}
      {showTextarea ? (
        <Textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Type your call notes here..."
          rows={8}
          className="text-base min-h-[200px] flex-1"
          autoFocus
        />
      ) : (
        transcript && (
          <div className="rounded-lg border bg-muted/30 p-4 max-h-[40vh] overflow-y-auto">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{transcript}</p>
          </div>
        )
      )}

      {/* Word count */}
      {transcript && (
        <p className="text-xs text-muted-foreground text-center">
          {wordCount} word{wordCount !== 1 ? "s" : ""}
        </p>
      )}

      {/* Tag: Phone Call vs Site Visit */}
      <div className="flex items-center justify-center gap-1 rounded-lg border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setIsSiteVisit(false)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            !isSiteVisit
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Phone className="h-3.5 w-3.5" />
          Phone Call
        </button>
        <button
          type="button"
          onClick={() => setIsSiteVisit(true)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            isSiteVisit
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MapPin className="h-3.5 w-3.5" />
          Site Visit
        </button>
      </div>

      {/* Toggle: voice vs type */}
      <button
        type="button"
        onClick={() => {
          if (recording) stopRecording();
          setShowTextarea(!showTextarea);
        }}
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
      >
        {showTextarea ? (
          <>
            <Mic className="h-4 w-4" />
            Switch to voice
          </>
        ) : (
          <>
            <Keyboard className="h-4 w-4" />
            Or type instead
          </>
        )}
      </button>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={!transcript.trim() || saving}
        className="w-full min-h-[52px] text-base gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Call Log"
        )}
      </Button>
    </div>
  );
}
