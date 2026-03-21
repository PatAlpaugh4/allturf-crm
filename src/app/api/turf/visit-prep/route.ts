import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { getLLM } from "@/lib/llm";
import { buildTurfContext, flattenContext } from "@/lib/turf-context";
import { buildSystemPrompt } from "@/lib/turf-safety";
import { createServiceClient } from "@/lib/supabase";

interface VisitPrepRequest {
  course_id: string;
  contact_id?: string;
}

export const POST = withApiProtection(async (request: Request) => {
  try {
    const body: VisitPrepRequest = await request.json();

    if (!body.course_id || typeof body.course_id !== "string") {
      return NextResponse.json(
        { error: "course_id is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Build standard context
    const context = await buildTurfContext({
      courseId: body.course_id,
      keywords: ["visit", "briefing", "disease", "risk", "seasonal"],
    });

    // Fetch additional visit-prep-specific data

    // Contact info
    let contactInfo = "";
    if (body.contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("first_name, last_name, title, role, phone, email, notes")
        .eq("id", body.contact_id)
        .single();

      if (contact) {
        contactInfo = `CONTACT: ${contact.first_name} ${contact.last_name}, ${contact.role || contact.title || "Unknown role"}`;
        if (contact.notes) contactInfo += ` | Notes: ${contact.notes}`;
      }
    }

    // Outstanding quotes/orders
    const { data: openDeals } = await supabase
      .from("deals")
      .select("name, stage, value_cad, expected_delivery_date, created_at")
      .eq("company_id", body.course_id)
      .not("stage", "in", '("Paid","Closed Lost")')
      .order("created_at", { ascending: false })
      .limit(5);

    let dealsContext = "";
    if (openDeals && openDeals.length > 0) {
      const lines = openDeals.map(
        (d) =>
          `${d.name} | ${d.stage} | $${d.value_cad} | delivery: ${d.expected_delivery_date || "TBD"}`
      );
      dealsContext = "OUTSTANDING QUOTES/ORDERS:\n" + lines.join("\n");
    }

    // Upcoming deliveries
    const { data: deliveries } = await supabase
      .from("order_deliveries")
      .select("scheduled_date, status, delivery_notes, deal:deals!inner(name, company_id)")
      .eq("deal.company_id", body.course_id)
      .in("status", ["Scheduled", "In Transit"])
      .order("scheduled_date", { ascending: true })
      .limit(5);

    let deliveriesContext = "";
    if (deliveries && deliveries.length > 0) {
      const lines = deliveries.map((d) => {
        const deal = d.deal as unknown as { name: string } | null;
        return `${deal?.name || "Unknown"} | ${d.status} | ${d.scheduled_date || "TBD"}`;
      });
      deliveriesContext = "UPCOMING DELIVERIES:\n" + lines.join("\n");
    }

    // Recent visit observations
    const { data: recentObs } = await supabase
      .from("visit_observations")
      .select(
        "severity, affected_area, notes, disease_pest:turf_diseases_pests(name, type), visit_report:visit_reports!inner(company_id, visit_date)"
      )
      .eq("visit_report.company_id", body.course_id)
      .order("created_at", { ascending: false })
      .limit(10);

    let obsContext = "";
    if (recentObs && recentObs.length > 0) {
      const lines = recentObs.map((o) => {
        const disease = o.disease_pest as unknown as { name: string; type: string } | null;
        const report = o.visit_report as unknown as { visit_date: string } | null;
        return `${report?.visit_date || "?"} | ${disease?.name || "Unknown"} (${disease?.type || "?"}) | severity: ${o.severity || "?"} | area: ${o.affected_area || "?"}`;
      });
      obsContext = "RECENT OBSERVATIONS:\n" + lines.join("\n");
    }

    const contextStr = flattenContext(context);

    // Compose user prompt
    const userPrompt = [
      `COURSE ID: ${body.course_id}`,
      contactInfo || null,
      contextStr || null,
      dealsContext || null,
      deliveriesContext || null,
      obsContext || null,
    ]
      .filter(Boolean)
      .join("\n\n");

    // Call LLM
    const llm = getLLM();
    const raw = await llm.chat({
      system: buildSystemPrompt("visitPrep"),
      user: userPrompt,
      temperature: 0.3,
      json: true,
    });

    const parsed = JSON.parse(raw);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[/api/turf/visit-prep] Error:", err);
    return NextResponse.json(
      { error: "Visit prep failed. Please try again." },
      { status: 500 }
    );
  }
});
