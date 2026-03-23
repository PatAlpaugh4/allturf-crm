import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase";

// Simple in-memory rate limiter (per-IP, resets on deploy)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // requests per window

function getRateLimitKey(request: Request): string {
  return request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(request: Request): NextResponse | null {
  const key = getRateLimitKey(request);
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return null;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  entry.count++;
  return null;
}

async function checkAuth(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

/**
 * Helper to get the authenticated user from cookies in an API route.
 * Returns { user, profile } or null if not authenticated.
 */
export async function getApiUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/**
 * Require admin role. Returns { user } or a NextResponse error.
 * Use inside withApiProtection handlers that need admin access.
 */
export async function requireAdmin(): Promise<
  { user: { id: string }; error?: never } | { user?: never; error: NextResponse }
> {
  const user = await getApiUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { createServiceClient } = await import("@/lib/supabase");
  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }

  return { user };
}

/**
 * Wraps an API route handler with rate limiting and basic auth checks.
 * Passes through additional arguments (e.g. route context with params).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withApiProtection<T extends any[]>(
  handler: (request: Request, ...args: T) => Promise<NextResponse>
): (request: Request, ...args: T) => Promise<NextResponse> {
  return async (request: Request, ...args: T) => {
    const rateLimitResponse = checkRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const authResponse = await checkAuth();
    if (authResponse) return authResponse;

    return handler(request, ...args);
  };
}

/**
 * Sanitize user input before embedding in AI prompts.
 * Escapes characters that could be used for prompt injection.
 */
export function sanitizeForPrompt(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ")
    .slice(0, 10000); // hard cap per field
}
