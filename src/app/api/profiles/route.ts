import { NextResponse } from "next/server";

import { z } from "zod";

import type { BuilderProfile } from "@/app/(main)/dashboard/next-move/_components/data";
import { mapBuilderProfile, toBuilderProfileRow } from "@/lib/aabw/supabase-mappers";
import { createClient } from "@/lib/server";

const profileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  project: z.string().min(1),
  track: z.string().default("Builder Experience"),
  goals: z.array(z.string()).default([]),
  stack: z.array(z.string()).default([]),
  skillGaps: z.array(z.string()).default([]),
  currentVenue: z.string().min(1),
  priority: z.enum(["learn", "debug", "find-team", "prepare-demo"]),
});

export async function POST(request: Request) {
  const parsed = profileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const profile = parsed.data satisfies BuilderProfile;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("builder_profiles")
      .upsert(toBuilderProfileRow(profile), { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ persisted: false, profile, reason: error.message });
    }

    return NextResponse.json({ persisted: true, profile: mapBuilderProfile(data) });
  } catch (error) {
    return NextResponse.json({
      persisted: false,
      profile,
      reason: error instanceof Error ? error.message : "Unknown Supabase error",
    });
  }
}
