import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, createServiceClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

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

// Store resolved user per-request to avoid double resolution
const requestUserMap = new WeakMap<Request, User>();

/**
 * Resolve the authenticated user from either:
 *   1. next/headers cookies (SSR server client)
 *   2. Authorization: Bearer <token> header (service client)
 * Returns the Supabase User or null.
 */
async function resolveUser(request?: Request): Promise<User | null> {
  // Return cached user if already resolved for this request
  if (request && requestUserMap.has(request)) {
    return requestUserMap.get(request)!;
  }

  // Try Authorization header FIRST (most reliable on Vercel)
  if (request) {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token) {
      const supabase = createServiceClient();
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        requestUserMap.set(request, user);
        return user;
      }
    }
  }

  // Fallback: cookies (works in some SSR contexts)
  try {
    const cookieStore = await cookies();
    const safeCookieStore = {
      getAll() { return cookieStore.getAll(); },
      set(name: string, value: string, options?: Record<string, unknown>) {
        try { cookieStore.set(name, value, options ?? {}); } catch { /* read-only */ }
      },
    };
    const supabase = createServerClient(safeCookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      if (request) requestUserMap.set(request, user);
      return user;
    }
  } catch {
    // cookies() may throw in some contexts
  }

  return null;
}

/**
 * Helper to get the authenticated user from an API route.
 */
export async function getApiUser(request?: Request) {
  return resolveUser(request);
}

/**
 * Require admin role. Returns { user } or a NextResponse error.
 * Use inside withApiProtection handlers that need admin access.
 */
export async function requireAdmin(request?: Request): Promise<
  { user: User; error?: never } | { user?: never; error: NextResponse }
> {
  const user = await resolveUser(request);
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

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

    const user = await resolveUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return handler(request, ...args);
  };
}

/**
 * Sanitize user search input before interpolation into PostgREST filter strings.
 * Strips characters that have special meaning in PostgREST syntax.
 */
export function sanitizeSearch(input: string): string {
  return input.replace(/[,.()"'\\]/g, "").trim().slice(0, 200);
}

/**
 * Parse and clamp an integer query parameter within safe bounds.
 */
export function clampInt(value: string | null, defaultVal: number, min: number, max: number): number {
  const n = parseInt(value ?? "", 10);
  if (isNaN(n)) return defaultVal;
  return Math.min(Math.max(n, min), max);
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
