import { NextResponse } from "next/server";

import { z } from "zod";

import { createClient } from "@/lib/server";

const upsertSchema = z.object({
  sessionId: z.string().min(1),
  items: z.array(
    z.object({
      id: z.string().min(1),
      completed: z.boolean(),
    }),
  ),
});

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ completedItems: [], persisted: false, reason: "Missing sessionId." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("builder_checklist_items")
      .select("item_id, completed")
      .eq("session_id", sessionId);

    if (error) {
      return NextResponse.json({ completedItems: [], persisted: false, reason: error.message });
    }

    return NextResponse.json({
      completedItems: (data ?? []).filter((item) => item.completed).map((item) => item.item_id),
      persisted: true,
    });
  } catch (error) {
    return NextResponse.json({
      completedItems: [],
      persisted: false,
      reason: error instanceof Error ? error.message : "Checklist read failed.",
    });
  }
}

export async function POST(request: Request) {
  const parsed = upsertSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten(), persisted: false }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const rows = parsed.data.items.map((item) => ({
      session_id: parsed.data.sessionId,
      item_id: item.id,
      completed: item.completed,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("builder_checklist_items").upsert(rows, {
      onConflict: "session_id,item_id",
    });

    if (error) {
      return NextResponse.json({ persisted: false, reason: error.message });
    }

    return NextResponse.json({ persisted: true, completedItems: parsed.data.items.filter((item) => item.completed) });
  } catch (error) {
    return NextResponse.json({
      persisted: false,
      reason: error instanceof Error ? error.message : "Checklist write failed.",
    });
  }
}
