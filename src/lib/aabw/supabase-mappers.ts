import type {
  BuilderProfile,
  Deadline,
  EventBlock,
  EventDay,
  Mentor,
  Resource,
  Venue,
} from "@/app/(main)/dashboard/next-move/_components/data";

type UnknownRecord = Record<string, unknown>;

function stringValue(row: UnknownRecord, key: string) {
  return typeof row[key] === "string" ? row[key] : "";
}

function arrayValue(row: UnknownRecord, key: string) {
  return Array.isArray(row[key]) ? row[key].filter((item): item is string => typeof item === "string") : [];
}

function dayValue(row: UnknownRecord, key: string): EventDay {
  const value = typeof row[key] === "number" ? row[key] : 1;
  return value >= 1 && value <= 5 ? (value as EventDay) : 1;
}

function numberValue(row: UnknownRecord, key: string) {
  return typeof row[key] === "number" ? row[key] : 0;
}

export function mapVenue(row: UnknownRecord): Venue {
  return {
    id: stringValue(row, "id"),
    name: stringValue(row, "name"),
    area: stringValue(row, "area"),
    travelNote: stringValue(row, "travel_note"),
    lat: numberValue(row, "lat"),
    lng: numberValue(row, "lng"),
  };
}

export function mapEventBlock(row: UnknownRecord): EventBlock {
  return {
    id: stringValue(row, "id"),
    day: dayValue(row, "day"),
    time: stringValue(row, "time"),
    endTime: stringValue(row, "end_time"),
    title: stringValue(row, "title"),
    host: stringValue(row, "host"),
    venueId: stringValue(row, "venue_id"),
    type: stringValue(row, "type") as EventBlock["type"],
    tags: arrayValue(row, "tags"),
    outcome: stringValue(row, "outcome"),
    capacity: stringValue(row, "capacity") as EventBlock["capacity"],
  };
}

export function mapResource(row: UnknownRecord): Resource {
  return {
    id: stringValue(row, "id"),
    title: stringValue(row, "title"),
    partner: stringValue(row, "partner"),
    type: stringValue(row, "type") as Resource["type"],
    tags: arrayValue(row, "tags"),
    action: stringValue(row, "action"),
  };
}

export function mapMentor(row: UnknownRecord): Mentor {
  return {
    id: stringValue(row, "id"),
    name: stringValue(row, "name"),
    focus: stringValue(row, "focus"),
    venueId: stringValue(row, "venue_id"),
    slot: stringValue(row, "slot"),
    tags: arrayValue(row, "tags"),
  };
}

export function mapDeadline(row: UnknownRecord): Deadline {
  return {
    id: stringValue(row, "id"),
    day: dayValue(row, "day"),
    time: stringValue(row, "time"),
    title: stringValue(row, "title"),
    detail: stringValue(row, "detail"),
    severity: stringValue(row, "severity") as Deadline["severity"],
  };
}

export function mapBuilderProfile(row: UnknownRecord): BuilderProfile {
  return {
    id: stringValue(row, "id"),
    name: stringValue(row, "name"),
    project: stringValue(row, "project"),
    track: stringValue(row, "track") || "Builder Experience",
    goals: arrayValue(row, "goals"),
    stack: arrayValue(row, "stack"),
    skillGaps: arrayValue(row, "skill_gaps"),
    currentVenue: stringValue(row, "current_venue"),
    priority: stringValue(row, "priority") as BuilderProfile["priority"],
  };
}

export function toBuilderProfileRow(profile: BuilderProfile) {
  return {
    id: profile.id,
    name: profile.name,
    project: profile.project,
    track: profile.track,
    goals: profile.goals,
    stack: profile.stack,
    skill_gaps: profile.skillGaps,
    current_venue: profile.currentVenue,
    priority: profile.priority,
    updated_at: new Date().toISOString(),
  };
}
