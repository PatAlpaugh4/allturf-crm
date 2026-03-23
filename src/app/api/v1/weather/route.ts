import { NextResponse } from "next/server";
import { withApiProtection, pickFields } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

const ALLOWED_FIELDS = [
  "company_id", "snapshot_date", "temp_high_c", "temp_low_c", "temp_avg_c",
  "humidity_pct", "wind_avg_kmh", "wind_gust_kmh", "rainfall_mm",
  "soil_temp_c", "soil_moisture_pct", "gdd_daily", "gdd_cumulative",
  "gdd_base_temp_c", "is_spray_window", "conditions", "forecast_summary", "notes",
] as const;

// GET — list weather snapshots with GDD calculations
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const sprayWindow = searchParams.get("spray_window");

  if (!companyId) {
    return NextResponse.json({ error: "company_id is required" }, { status: 400 });
  }

  let query = supabase
    .from("weather_snapshots")
    .select("*, company:companies(id, name)")
    .eq("company_id", companyId)
    .order("snapshot_date", { ascending: false });

  if (from) query = query.gte("snapshot_date", from);
  if (to) query = query.lte("snapshot_date", to);
  if (sprayWindow === "true") query = query.eq("is_spray_window", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Calculate season GDD summary
  const seasonGdd = data?.reduce((max, s) => {
    const gdd = s.gdd_cumulative || 0;
    return gdd > max ? gdd : max;
  }, 0) || 0;

  return NextResponse.json({
    snapshots: data,
    summary: {
      total_records: data?.length || 0,
      season_gdd_cumulative: seasonGdd,
      spray_window_days: data?.filter((s) => s.is_spray_window).length || 0,
    },
  });
});

// POST — create or upsert a weather snapshot
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.company_id || !body.snapshot_date) {
    return NextResponse.json(
      { error: "company_id and snapshot_date are required" },
      { status: 400 }
    );
  }

  const insert = pickFields(body, ALLOWED_FIELDS);

  // Calculate GDD if temp data provided
  if (insert.temp_high_c != null && insert.temp_low_c != null && insert.gdd_daily == null) {
    const baseTempC = (insert.gdd_base_temp_c as number) || 10;
    const avgTemp = ((insert.temp_high_c as number) + (insert.temp_low_c as number)) / 2;
    insert.gdd_daily = Math.max(0, avgTemp - baseTempC);
  }

  // Calculate spray window if conditions provided
  if (insert.is_spray_window == null) {
    const wind = (insert.wind_avg_kmh as number) || 0;
    const rain = (insert.rainfall_mm as number) || 0;
    const temp = (insert.temp_avg_c as number) || 0;
    insert.is_spray_window = wind < 15 && rain < 2 && temp >= 10 && temp <= 30;
  }

  // Upsert on (company_id, snapshot_date)
  const { data, error } = await supabase
    .from("weather_snapshots")
    .upsert(insert, { onConflict: "company_id,snapshot_date" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});
