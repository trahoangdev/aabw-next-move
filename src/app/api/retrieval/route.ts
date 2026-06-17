import { NextResponse } from "next/server";

import OpenAI from "openai";
import { z } from "zod";

import { deadlines, mentors, resources, schedule, venues } from "@/app/(main)/dashboard/next-move/_components/data";
import { createClient } from "@/lib/server";

const requestSchema = z.object({
  query: z.string().min(1),
  matchCount: z.number().int().min(1).max(10).default(6),
});

type RetrievalMatch = {
  id: string;
  sourceType: "event" | "resource" | "mentor" | "deadline" | "venue";
  sourceId: string;
  title: string;
  body: string;
  tags: string[];
  similarity: number;
};

type EventDocumentRow = {
  id: string;
  source_type: RetrievalMatch["sourceType"];
  source_id: string;
  title: string;
  body: string;
  tags: string[] | null;
  similarity?: number;
};

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const fallback = fallbackMatches(parsed.data.query, parsed.data.matchCount);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      source: "keyword",
      reason: "OPENAI_API_KEY is not configured.",
      matches: fallback,
    });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const embedding = await openai.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      input: parsed.data.query,
    });

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("match_event_documents", {
      query_embedding: embedding.data[0].embedding,
      match_count: parsed.data.matchCount,
    });

    if (error || !data?.length) {
      return NextResponse.json({
        source: "keyword",
        reason: error?.message ?? "No vector matches yet. Run /api/embeddings/seed after applying schema.sql.",
        matches: fallback,
      });
    }

    return NextResponse.json({
      source: "pgvector",
      matches: (data as EventDocumentRow[]).map(mapMatch),
    });
  } catch (error) {
    return NextResponse.json({
      source: "keyword",
      reason: error instanceof Error ? error.message : "Vector retrieval failed.",
      matches: fallback,
    });
  }
}

function fallbackMatches(query: string, matchCount: number): RetrievalMatch[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter(Boolean);

  return mockDocuments()
    .map((document) => ({
      document,
      score: terms.reduce((score, term) => score + (document.searchText.includes(term) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score || a.document.title.localeCompare(b.document.title))
    .slice(0, matchCount)
    .map(({ document, score }) => ({
      id: document.id,
      sourceType: document.sourceType,
      sourceId: document.sourceId,
      title: document.title,
      body: document.body,
      tags: document.tags,
      similarity: Math.min(0.95, 0.35 + score * 0.12),
    }));
}

function mockDocuments() {
  const eventDocuments = schedule.map((event) => ({
    id: `event:${event.id}`,
    sourceType: "event" as const,
    sourceId: event.id,
    title: event.title,
    body: `${event.title}. ${event.host}. Day ${event.day}, ${event.time}-${event.endTime}. ${event.outcome}`,
    tags: event.tags,
  }));

  const resourceDocuments = resources.map((resource) => ({
    id: `resource:${resource.id}`,
    sourceType: "resource" as const,
    sourceId: resource.id,
    title: resource.title,
    body: `${resource.title}. ${resource.partner}. ${resource.action}`,
    tags: resource.tags,
  }));

  const mentorDocuments = mentors.map((mentor) => ({
    id: `mentor:${mentor.id}`,
    sourceType: "mentor" as const,
    sourceId: mentor.id,
    title: mentor.name,
    body: `${mentor.name}. ${mentor.focus}. ${mentor.slot}.`,
    tags: mentor.tags,
  }));

  const deadlineDocuments = deadlines.map((deadline) => ({
    id: `deadline:${deadline.id}`,
    sourceType: "deadline" as const,
    sourceId: deadline.id,
    title: deadline.title,
    body: `${deadline.title}. Day ${deadline.day}, ${deadline.time}. ${deadline.detail}`,
    tags: [deadline.severity],
  }));

  const venueDocuments = venues.map((venue) => ({
    id: `venue:${venue.id}`,
    sourceType: "venue" as const,
    sourceId: venue.id,
    title: venue.name,
    body: `${venue.name}. ${venue.area}. ${venue.travelNote}`,
    tags: ["venue", venue.area.toLowerCase()],
  }));

  return [...eventDocuments, ...resourceDocuments, ...mentorDocuments, ...deadlineDocuments, ...venueDocuments].map(
    (document) => ({
      ...document,
      searchText: `${document.title} ${document.body} ${document.tags.join(" ")}`.toLowerCase(),
    }),
  );
}

function mapMatch(row: EventDocumentRow): RetrievalMatch {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    title: row.title,
    body: row.body,
    tags: row.tags ?? [],
    similarity: row.similarity ?? 0,
  };
}
