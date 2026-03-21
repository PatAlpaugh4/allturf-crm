import { NextResponse } from "next/server";

/**
 * Shared API utilities for all /api/v1/ routes.
 * Uses PROJECT_SYNC_API_KEY for Bearer token authentication.
 */

export function authenticateBearerToken(request: Request): boolean {
  const key = process.env.PROJECT_SYNC_API_KEY;
  if (!key) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${key}`;
}

export function success(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function successWithMeta(data: unknown, meta: Record<string, unknown>, status = 200) {
  return NextResponse.json({ success: true, data, meta }, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function parseBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function parsePagination(searchParams: URLSearchParams): { limit: number; offset: number } {
  let limit = parseInt(searchParams.get("limit") ?? "50", 10);
  if (isNaN(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;

  let offset = parseInt(searchParams.get("offset") ?? "0", 10);
  if (isNaN(offset) || offset < 0) offset = 0;

  return { limit, offset };
}
