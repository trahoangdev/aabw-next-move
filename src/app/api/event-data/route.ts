import { NextResponse } from "next/server";

import {
  deadlines as mockDeadlines,
  mentors as mockMentors,
  profiles as mockProfiles,
  resources as mockResources,
  schedule as mockSchedule,
  venues as mockVenues,
} from "@/app/(main)/dashboard/next-move/_components/data";
import {
  mapBuilderProfile,
  mapDeadline,
  mapEventBlock,
  mapMentor,
  mapResource,
  mapVenue,
} from "@/lib/aabw/supabase-mappers";
import { createClient } from "@/lib/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const [venues, schedule, resources, mentors, deadlines, builderProfiles] = await Promise.all([
      supabase.from("venues").select("*").order("id"),
      supabase.from("event_blocks").select("*").order("day").order("time"),
      supabase.from("resources").select("*").order("id"),
      supabase.from("mentors").select("*").order("id"),
      supabase.from("deadlines").select("*").order("day").order("time"),
      supabase.from("builder_profiles").select("*").order("created_at", { ascending: false }).limit(20),
    ]);

    const errors = [venues.error, schedule.error, resources.error, mentors.error, deadlines.error].filter(Boolean);
    if (errors.length > 0 || !venues.data?.length || !schedule.data?.length) {
      return NextResponse.json(mockPayload("mock", errors[0]?.message ?? "Supabase tables are not seeded yet."));
    }

    return NextResponse.json({
      source: "supabase",
      venues: venues.data.map(mapVenue),
      schedule: schedule.data.map(mapEventBlock),
      resources: (resources.data ?? []).map(mapResource),
      mentors: (mentors.data ?? []).map(mapMentor),
      deadlines: (deadlines.data ?? []).map(mapDeadline),
      profiles: [...mockProfiles, ...(builderProfiles.data ?? []).map(mapBuilderProfile)],
    });
  } catch (error) {
    return NextResponse.json(mockPayload("mock", error instanceof Error ? error.message : "Unknown Supabase error"));
  }
}

function mockPayload(source: "mock", reason: string) {
  return {
    source,
    reason,
    venues: mockVenues,
    schedule: mockSchedule,
    resources: mockResources,
    mentors: mockMentors,
    deadlines: mockDeadlines,
    profiles: mockProfiles,
  };
}
