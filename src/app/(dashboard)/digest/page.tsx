"use client";

import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";

const DigestClient = dynamic(() => import("./digest-client"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-3xl space-y-8 pb-12 pt-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-primary/70 mb-1">Daily Digest</p>
          <div className="skeleton h-7 w-48 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="border-border/30">
            <CardContent className="p-5 space-y-2">
              <div className="skeleton h-8 w-16 mx-auto rounded" style={{ animationDelay: `${i * 100}ms` }} />
              <div className="skeleton h-3 w-20 mx-auto rounded" style={{ animationDelay: `${i * 100 + 50}ms` }} />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-0 shadow-[var(--shadow-elevated)]">
        <CardContent className="p-6 space-y-3">
          <div className="skeleton h-3 w-32 rounded" style={{ animationDelay: "200ms" }} />
          <div className="skeleton h-4 w-full rounded" style={{ animationDelay: "300ms" }} />
          <div className="skeleton h-4 w-5/6 rounded" style={{ animationDelay: "400ms" }} />
          <div className="skeleton h-4 w-4/6 rounded" style={{ animationDelay: "500ms" }} />
        </CardContent>
      </Card>
    </div>
  ),
});

export default function DigestPage() {
  return <DigestClient />;
}
