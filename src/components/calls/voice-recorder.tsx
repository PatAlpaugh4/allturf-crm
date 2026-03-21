"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Square } from "lucide-react";

interface VoiceRecorderProps {
  onTranscriptChange: (text: string) => void;
  transcript: string;
  className?: string;
}

export function VoiceRecorder({
  onTranscriptChange,
  transcript,
  className,
}: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [interimText, setInterimText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef(transcript);

  // Keep ref in sync with prop
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Detect browser support on mount
  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    setSupported(!!SpeechRecognitionAPI);
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
        onTranscriptChange(updated);
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
        "no-speech": "No speech detected. Please try again.",
        "network": "Network error. Check your connection and try again.",
        "aborted": "Recording was interrupted.",
      };
      const msg = messages[errorCode] || `Speech recognition error: ${errorCode}`;
      setErrorMessage(msg);
      setRecording(false);
      setInterimText("");
    };

    recognition.onend = () => {
      // Auto-restart if still in recording mode (handles browser's ~60s timeout)
      if (recognitionRef.current === recognition && recording) {
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
  }, [onTranscriptChange, recording]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
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

  if (supported === null) return null;

  if (!supported) {
    return (
      <div className={`flex flex-col items-center gap-3 ${className || ""}`}>
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-muted">
          <MicOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Voice recording is not supported in this browser.
          <br />
          Use Chrome or Safari on mobile for best results.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-4 ${className || ""}`}>
      {/* Record / Stop button */}
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

      {/* Live interim text */}
      {interimText && (
        <p className="text-sm text-muted-foreground italic text-center px-4">
          {interimText}
        </p>
      )}

      {errorMessage && (
        <p className="text-sm text-destructive text-center px-4">
          {errorMessage}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {recording ? "Tap square to stop" : "Tap microphone to start dictating"}
      </p>
    </div>
  );
}
