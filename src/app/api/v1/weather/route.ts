import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

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
  const body = await request.json();

  if (!body.company_id || !body.snapshot_date) {
    return NextResponse.json(
      { error: "company_id and snapshot_date are required" },
      { status: 400 }
    );
  }

  // Calculate GDD if temp data provided
  if (body.temp_high_c != null && body.temp_low_c != null && body.gdd_daily == null) {
    const baseTempC = body.gdd_base_temp_c || 10;
    const avgTemp = (body.temp_high_c + body.temp_low_c) / 2;
    body.gdd_daily = Math.max(0, avgTemp - baseTempC);
  }

  // Calculate spray window if conditions provided
  if (body.is_spray_window == null) {
    const wind = body.wind_avg_kmh || 0;
    const rain = body.rainfall_mm || 0;
    const temp = body.temp_avg_c || 0;
    body.is_spray_window = wind < 15 && rain < 2 && temp >= 10 && temp <= 30;
  }

  // Upsert on (company_id, snapshot_date)
  const { data, error } = await supabase
    .from("weather_snapshots")
    .upsert(body, { onConflict: "company_id,snapshot_date" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});
