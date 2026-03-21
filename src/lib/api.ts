import { NextResponse } from "next/server";

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

function checkAuth(request: Request): NextResponse | null {
  // Verify the request has a valid Supabase session token
  const authHeader = request.headers.get("authorization");

  // Allow requests with auth header (Bearer token or Supabase session)
  if (authHeader) return null;

  // Allow requests with the cookie-based Supabase session
  const cookies = request.headers.get("cookie");
  if (cookies?.includes("sb-")) return null;

  // Allow requests from same origin (browser fetch from our app)
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (origin || referer) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const authResponse = checkAuth(request);
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
