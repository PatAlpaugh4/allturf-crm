"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — background image (hidden on mobile) */}
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-3/5">
        <Image
          src="/golf-sunset.jpg"
          alt="Golf course at sunset"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/70" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <Image
            src="/logo-allturf.png"
            alt="Allturf"
            width={200}
            height={60}
            className="mb-4"
          />
          <p className="max-w-md text-lg text-white/80">
            Turf management &amp; sales platform for Ontario&apos;s golf courses.
          </p>
        </div>
      </div>

      {/* Mobile hero strip (visible on mobile only) */}
      <div className="relative h-40 w-full lg:hidden">
        <Image
          src="/golf-sunset.jpg"
          alt="Golf course at sunset"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/70" />
        <div className="relative z-10 flex h-full items-center justify-center">
          <Image
            src="/logo-allturf.png"
            alt="Allturf"
            width={160}
            height={48}
          />
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full flex-col items-center justify-center bg-background px-4 py-12 lg:w-1/2 xl:w-2/5">
        <div className="w-full max-w-[26rem] space-y-8">
          {/* Logo & heading */}
          <div className="text-center">
            <div className="mx-auto mb-5 hidden lg:block">
              <Image
                src="/logo-allturf.png"
                alt="Allturf"
                width={180}
                height={54}
                className="mx-auto"
              />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              Sign in to Allturf
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
                className="h-12 px-4 text-[15px]"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                disabled={loading}
                minLength={6}
                className="h-12 px-4 text-[15px]"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full h-12 text-[15px]" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
