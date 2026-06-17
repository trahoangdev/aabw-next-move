import { NextResponse } from "next/server";

import { z } from "zod";

import { createClient } from "@/lib/server";

const recommendationSchema = z.object({
  sessionId: z.string().min(1),
  profileId: z.string().min(1),
  profileName: z.string().min(1),
  day: z.string().min(1),
  selectedTime: z.string().min(1),
  title: z.string().min(1),
  venue: z.string().min(1),
  planText: z.string().min(1),
  aiSource: z.enum(["openai", "deterministic"]),
  retrievalSource: z.enum(["pgvector", "keyword"]),
  matchScore: z.number().int().min(0).max(100),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().min(1),
});

type SavedRecommendationRow = {
  id: string;
  session_id: string;
  profile_id: string;
  profile_name: string;
  day: string;
  selected_time: string;
  title: string;
  venue: string;
  plan_text: string;
  ai_source: "openai" | "deterministic";
  retrieval_source: "pgvector" | "keyword";
  match_score: number;
  created_at: string;
};

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ persisted: false, recommendations: [], reason: "Missing sessionId." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("saved_recommendations")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      return NextResponse.json({ persisted: false, recommendations: [], reason: error.message });
    }

    return NextResponse.json({
      persisted: true,
      recommendations: ((data ?? []) as SavedRecommendationRow[]).map(mapSavedRecommendation),
    });
  } catch (error) {
    return NextResponse.json({
      persisted: false,
      recommendations: [],
      reason: error instanceof Error ? error.message : "Saved recommendation read failed.",
    });
  }
}

export async function POST(request: Request) {
  const parsed = recommendationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten(), persisted: false }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("saved_recommendations")
      .insert({
        session_id: parsed.data.sessionId,
        profile_id: parsed.data.profileId,
        profile_name: parsed.data.profileName,
        day: parsed.data.day,
        selected_time: parsed.data.selectedTime,
        title: parsed.data.title,
        venue: parsed.data.venue,
        plan_text: parsed.data.planText,
        ai_source: parsed.data.aiSource,
        retrieval_source: parsed.data.retrievalSource,
        match_score: parsed.data.matchScore,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ persisted: false, reason: error.message });
    }

    return NextResponse.json({
      persisted: true,
      recommendation: mapSavedRecommendation(data as SavedRecommendationRow),
    });
  } catch (error) {
    return NextResponse.json({
      persisted: false,
      reason: error instanceof Error ? error.message : "Saved recommendation write failed.",
    });
  }
}

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten(), persisted: false }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("saved_recommendations")
      .delete()
      .eq("id", parsed.data.id)
      .eq("session_id", parsed.data.sessionId);

    if (error) {
      return NextResponse.json({ persisted: false, reason: error.message });
    }

    return NextResponse.json({ persisted: true });
  } catch (error) {
    return NextResponse.json({
      persisted: false,
      reason: error instanceof Error ? error.message : "Saved recommendation delete failed.",
    });
  }
}

function mapSavedRecommendation(row: SavedRecommendationRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    profileId: row.profile_id,
    profileName: row.profile_name,
    day: row.day,
    selectedTime: row.selected_time,
    title: row.title,
    venue: row.venue,
    planText: row.plan_text,
    aiSource: row.ai_source,
    retrievalSource: row.retrieval_source,
    matchScore: row.match_score,
    createdAt: row.created_at,
  };
}
