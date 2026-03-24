"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function DigestError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Digest page error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl pt-8">
      <Card className="border-0 shadow-[var(--shadow-elevated)]">
        <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-16 w-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
          </div>
          <div className="text-center">
            <p className="font-medium">Something went wrong loading the digest</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {error.message}
            </p>
          </div>
          <Button onClick={reset} className="min-h-[44px]">
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
