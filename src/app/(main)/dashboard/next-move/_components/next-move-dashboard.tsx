"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  AlarmClockCheck,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  ClipboardCopy,
  Clock3,
  Compass,
  Flag,
  Gauge,
  Handshake,
  Lightbulb,
  MapPin,
  Megaphone,
  Pencil,
  RadioTower,
  RotateCcw,
  Route,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  type BuilderProfile,
  type EventBlock,
  type EventDay,
  eventDays,
  deadlines as mockDeadlines,
  mentors as mockMentors,
  resources as mockResources,
  schedule as mockSchedule,
  venues as mockVenues,
  profiles as seedProfiles,
  type Venue,
} from "./data";

const demoTimes = ["09:00", "10:30", "14:00", "18:30", "21:30"];
const customProfilesKey = "aabw-next-move-custom-profiles";
const completedItemsKey = "aabw-next-move-completed-items";
const selectedStateKey = "aabw-next-move-selected-state";
const sessionIdKey = "aabw-next-move-session-id";

type DraftProfile = Omit<BuilderProfile, "goals" | "stack" | "skillGaps"> & {
  goals: string;
  stack: string;
  skillGaps: string;
};

type SavedState = {
  profileId: string;
  selectedDay: EventDay;
  selectedTime: string;
};

type EventDataPayload = {
  source: "supabase" | "mock";
  reason?: string;
  venues: typeof mockVenues;
  schedule: typeof mockSchedule;
  resources: typeof mockResources;
  mentors: typeof mockMentors;
  deadlines: typeof mockDeadlines;
  profiles: BuilderProfile[];
};

type AiInsight = {
  source: "openai" | "deterministic";
  explanation: string;
  now: string;
  next: string;
  beforeDemo: string;
  risk: string;
  reason?: string;
};

type RetrievalMatch = {
  id: string;
  sourceType: "event" | "resource" | "mentor" | "deadline" | "venue";
  sourceId: string;
  title: string;
  body: string;
  tags: string[];
  similarity: number;
};

type RetrievalPayload = {
  source: "pgvector" | "keyword";
  reason?: string;
  matches: RetrievalMatch[];
};

type SavedRecommendation = {
  id: string;
  sessionId: string;
  profileId: string;
  profileName: string;
  day: string;
  selectedTime: string;
  title: string;
  venue: string;
  planText: string;
  aiSource: "openai" | "deterministic";
  retrievalSource: "pgvector" | "keyword";
  matchScore: number;
  createdAt: string;
};

type TriageItem = {
  id: string;
  title: string;
  detail: string;
  kind: "venue" | "mentor" | "perk" | "deadline" | "team" | "community";
};

type LaunchItem = {
  id: string;
  title: string;
  detail: string;
};

type RiskLevel = "critical" | "watch" | "clear";

type EventModeSignal = {
  id: string;
  title: string;
  detail: string;
  level: RiskLevel;
};

type TeamMatch = {
  profile: BuilderProfile;
  score: number;
  reasons: string[];
  ask: string;
  offer: string;
};

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinuteDelta(minutes: number) {
  if (minutes === 0) return "now";
  const absMinutes = Math.abs(minutes);
  const hours = Math.floor(absMinutes / 60);
  const remaining = absMinutes % 60;
  const parts = [hours ? `${hours}h` : null, remaining ? `${remaining}m` : null].filter(Boolean).join(" ");
  return minutes > 0 ? `in ${parts}` : `${parts} ago`;
}

function overlapScore(a: string[], b: string[]) {
  const bSet = new Set(b);
  return a.reduce((score, item) => score + (bSet.has(item) ? 1 : 0), 0);
}

function venueName(id: string, venueList: typeof mockVenues) {
  return venueList.find((venue) => venue.id === id)?.name ?? id;
}

function uniqueProfiles(profileList: BuilderProfile[]) {
  const seen = new Set<string>();
  return profileList.filter((profile) => {
    if (seen.has(profile.id)) return false;
    seen.add(profile.id);
    return true;
  });
}

function defaultEventData(): EventDataPayload {
  return {
    source: "mock",
    venues: mockVenues,
    schedule: mockSchedule,
    resources: mockResources,
    mentors: mockMentors,
    deadlines: mockDeadlines,
    profiles: seedProfiles,
  };
}

function scoreBlock(block: EventBlock, profile: BuilderProfile, selectedTime: string) {
  const start = toMinutes(block.time);
  const now = toMinutes(selectedTime);
  const minutesUntil = start - now;
  const profileSignals = [...profile.goals, ...profile.stack, ...profile.skillGaps, profile.priority];
  const relevance = overlapScore(block.tags, profileSignals) * 18;
  const timing = minutesUntil >= 0 && minutesUntil <= 90 ? 24 : minutesUntil > 90 && minutesUntil <= 240 ? 12 : 0;
  const urgency = block.capacity === "nearly-full" ? 8 : block.capacity === "limited" ? 4 : 0;
  const location = block.venueId === profile.currentVenue ? 12 : -4;

  return relevance + timing + urgency + location;
}

function explainMove(block: EventBlock, profile: BuilderProfile) {
  const matchedGoals = block.tags.filter((tag) => profile.goals.includes(tag));
  const matchedStack = block.tags.filter((tag) => profile.stack.includes(tag));
  const matchedGaps = block.tags.filter((tag) => profile.skillGaps.includes(tag));
  const reasons = [
    matchedGoals.length ? `matches your ${matchedGoals.join(", ")} goal` : null,
    matchedStack.length ? `fits your ${matchedStack.join(", ")} stack` : null,
    matchedGaps.length ? `covers your ${matchedGaps.join(", ")} gap` : null,
    block.capacity !== "open" ? `${block.capacity.replace("-", " ")} capacity` : null,
  ].filter(Boolean);

  return reasons.length
    ? `Recommended because it ${reasons.join(", ")}.`
    : "Recommended because it is the strongest upcoming event for your current day and venue.";
}

function getUpcomingBlocks(scheduleList: typeof mockSchedule, day: EventDay, selectedTime: string) {
  const now = toMinutes(selectedTime);
  return scheduleList
    .filter((block) => block.day === day && toMinutes(block.endTime) >= now - 15)
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}

function recommendation(
  scheduleList: typeof mockSchedule,
  profile: BuilderProfile,
  day: EventDay,
  selectedTime: string,
) {
  const upcoming = getUpcomingBlocks(scheduleList, day, selectedTime);
  const ranked = upcoming
    .map((block) => ({ block, score: scoreBlock(block, profile, selectedTime) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]?.block ?? scheduleList.find((block) => block.day === day) ?? scheduleList[0];
  const next = upcoming.find((block) => block.id !== best.id);

  return {
    best,
    next,
    score: Math.min(96, Math.max(58, ranked[0]?.score ?? 58)),
    explanation: explainMove(best, profile),
  };
}

function rankedDayBlocks(
  scheduleList: typeof mockSchedule,
  profile: BuilderProfile,
  day: EventDay,
  selectedTime: string,
) {
  return scheduleList
    .filter((block) => block.day === day)
    .map((block) => ({
      block,
      score: Math.min(96, Math.max(40, scoreBlock(block, profile, selectedTime))),
    }))
    .sort((a, b) => b.score - a.score || toMinutes(a.block.time) - toMinutes(b.block.time));
}

function relevantResources(resourceList: typeof mockResources, profile: BuilderProfile) {
  const signals = [...profile.goals, ...profile.stack, ...profile.skillGaps, profile.priority];
  return resourceList
    .map((resource) => ({
      resource,
      score: overlapScore(resource.tags, signals),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function relevantMentors(mentorList: typeof mockMentors, profile: BuilderProfile) {
  const signals = [...profile.goals, ...profile.stack, ...profile.skillGaps, profile.priority];
  return mentorList
    .map((mentor) => ({ mentor, score: overlapScore(mentor.tags, signals) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function recommendedTeamMatches(profileList: BuilderProfile[], profile: BuilderProfile) {
  return profileList
    .filter((candidate) => candidate.id !== profile.id)
    .map<TeamMatch>((candidate) => {
      const gapCoverage = candidate.stack.filter((signal) => profile.skillGaps.includes(signal));
      const goalCoverage = candidate.goals.filter((signal) => profile.skillGaps.includes(signal));
      const covers = Array.from(new Set([...gapCoverage, ...goalCoverage]));
      const reciprocalOffer = profile.stack.filter((signal) => candidate.skillGaps.includes(signal));
      const sharedGoals = candidate.goals.filter((signal) => profile.goals.includes(signal));
      const priorityBoost = candidate.priority === "find-team" || profile.priority === "find-team" ? 8 : 0;
      const score = Math.min(
        96,
        48 + covers.length * 16 + reciprocalOffer.length * 12 + sharedGoals.length * 8 + priorityBoost,
      );
      const reasons = [
        covers.length ? `covers your ${covers.join(", ")} gap` : null,
        reciprocalOffer.length ? `you can offer ${reciprocalOffer.join(", ")}` : null,
        sharedGoals.length ? `shared ${sharedGoals.join(", ")} goal` : null,
      ].filter(Boolean) as string[];

      return {
        profile: candidate,
        score,
        reasons: reasons.length ? reasons : ["adjacent Builder Experience project"],
        ask: covers.length
          ? `Ask for help with ${covers.join(", ")}`
          : `Compare ${candidate.priority.replace("-", " ")} notes`,
        offer: reciprocalOffer.length
          ? `Offer ${reciprocalOffer.join(", ")} help`
          : `Offer feedback on ${profile.project}`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function activeDeadlines(deadlineList: typeof mockDeadlines, day: EventDay) {
  return deadlineList.filter((deadline) => deadline.day >= day).slice(0, 3);
}

function deadlineMinutesFromNow(deadline: (typeof mockDeadlines)[number], day: EventDay, selectedTime: string) {
  return (deadline.day - day) * 24 * 60 + toMinutes(deadline.time) - toMinutes(selectedTime);
}

function liveEventSignals({
  best,
  profile,
  day,
  selectedTime,
  currentVenue,
  venueList,
  deadlineQueue,
  mentorName,
  resourceTitle,
}: {
  best: EventBlock;
  profile: BuilderProfile;
  day: EventDay;
  selectedTime: string;
  currentVenue: Venue;
  venueList: typeof mockVenues;
  deadlineQueue: typeof mockDeadlines;
  mentorName?: string;
  resourceTitle?: string;
}): EventModeSignal[] {
  const minutesUntil = toMinutes(best.time) - toMinutes(selectedTime);
  const recommendedVenue = venueList.find((venue) => venue.id === best.venueId) ?? currentVenue;
  const movingVenue = best.venueId !== profile.currentVenue;
  const topDeadline = deadlineQueue[0];
  const deadlineDelta = topDeadline ? deadlineMinutesFromNow(topDeadline, day, selectedTime) : undefined;

  const movementLevel: RiskLevel =
    movingVenue && minutesUntil <= 45 ? "critical" : movingVenue && minutesUntil <= 120 ? "watch" : "clear";
  const movementDetail = movingVenue
    ? `${recommendedVenue.travelNote} ${best.title} starts ${formatMinuteDelta(minutesUntil)}.`
    : `${best.title} is at your current venue. Find the room and arrive before ${best.time}.`;

  const deadlineLevel: RiskLevel =
    deadlineDelta === undefined
      ? "clear"
      : deadlineDelta <= 180
        ? "critical"
        : deadlineDelta <= 36 * 60
          ? "watch"
          : "clear";
  const deadlineDetail = topDeadline
    ? `${topDeadline.title} is ${formatMinuteDelta(deadlineDelta ?? 0)}: ${topDeadline.detail}`
    : "No active deadline is queued for the selected day.";

  return [
    {
      id: "movement",
      title: movingVenue ? `Move from ${currentVenue.area}` : "Stay and check the room",
      detail: movementDetail,
      level: movementLevel,
    },
    {
      id: "deadline",
      title: topDeadline ? "Deadline guardrail" : "Deadline clear",
      detail: deadlineDetail,
      level: deadlineLevel,
    },
    {
      id: "support",
      title: mentorName ? `Ask ${mentorName}` : "Open support route",
      detail: mentorName
        ? `Use this before you lose momentum. Matched resource: ${resourceTitle ?? "event help desk or Discord"}.`
        : "Copy the help request and route it through Discord, WhatsApp, or the on-site support desk.",
      level: mentorName ? "clear" : "watch",
    },
  ];
}

function splitSignals(value: string) {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function toDraftProfile(profile: BuilderProfile): DraftProfile {
  return {
    ...profile,
    goals: profile.goals.join(", "),
    stack: profile.stack.join(", "),
    skillGaps: profile.skillGaps.join(", "),
  };
}

function fromDraftProfile(draft: DraftProfile): BuilderProfile {
  return {
    ...draft,
    name: draft.name.trim() || "Untitled builder",
    project: draft.project.trim() || "Builder Experience project",
    track: "Builder Experience",
    goals: splitSignals(draft.goals),
    stack: splitSignals(draft.stack),
    skillGaps: splitSignals(draft.skillGaps),
  };
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function createSessionId() {
  if (typeof window !== "undefined" && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }

  return `session-${Date.now()}`;
}

function actionPlanText({
  profile,
  dayMeta,
  selectedTime,
  best,
  next,
  explanation,
  deadlineTitle,
  triageItems,
  venueList,
}: {
  profile: BuilderProfile;
  dayMeta: (typeof eventDays)[number];
  selectedTime: string;
  best: EventBlock;
  next?: EventBlock;
  explanation: string;
  deadlineTitle?: string;
  triageItems?: TriageItem[];
  venueList: typeof mockVenues;
}) {
  return [
    `AABW Next Move for ${profile.name}`,
    `${dayMeta.label} - ${dayMeta.theme} at ${selectedTime}`,
    "",
    `NOW: ${best.title}`,
    `Time: ${best.time}-${best.endTime}`,
    `Venue: ${venueName(best.venueId, venueList)}`,
    `Why: ${explanation}`,
    "",
    next ? `NEXT: ${next.title} (${next.time}-${next.endTime})` : "NEXT: Capture notes and update the README.",
    deadlineTitle ? `BEFORE DEMO: ${deadlineTitle}` : "BEFORE DEMO: Keep a fallback demo video and seeded data ready.",
    ...(triageItems?.length
      ? ["", "LIVE TRIAGE:", ...triageItems.map((item) => `- ${item.title}: ${item.detail}`)]
      : []),
  ].join("\n");
}

function supportRequestText({
  profile,
  dayMeta,
  selectedTime,
  best,
  mentorName,
  resourceTitle,
  deadlineTitle,
  venueList,
}: {
  profile: BuilderProfile;
  dayMeta: (typeof eventDays)[number];
  selectedTime: string;
  best: EventBlock;
  mentorName?: string;
  resourceTitle?: string;
  deadlineTitle?: string;
  venueList: typeof mockVenues;
}) {
  return [
    `AABW Builder help request - ${profile.name}`,
    `Project: ${profile.project}`,
    `Now: ${dayMeta.label} ${dayMeta.theme}, ${selectedTime}`,
    `Next move: ${best.title} at ${venueName(best.venueId, venueList)}`,
    `Need help with: ${profile.skillGaps.join(", ") || profile.priority.replace("-", " ")}`,
    mentorName ? `Best mentor/support lead: ${mentorName}` : null,
    resourceTitle ? `Relevant resource/perk: ${resourceTitle}` : null,
    deadlineTitle ? `Deadline to protect: ${deadlineTitle}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function onsiteBriefText({
  profile,
  dayMeta,
  selectedTime,
  best,
  signals,
  triageItems,
  venueList,
}: {
  profile: BuilderProfile;
  dayMeta: (typeof eventDays)[number];
  selectedTime: string;
  best: EventBlock;
  signals: EventModeSignal[];
  triageItems: TriageItem[];
  venueList: typeof mockVenues;
}) {
  return [
    `AABW Event Mode - ${profile.name}`,
    `${dayMeta.label} ${dayMeta.theme}, ${selectedTime}`,
    "",
    `GO NOW: ${best.title}`,
    `Where: ${venueName(best.venueId, venueList)}`,
    `When: ${best.time}-${best.endTime}`,
    "",
    "RISK CHECK:",
    ...signals.map((signal) => `- ${signal.level.toUpperCase()}: ${signal.title} - ${signal.detail}`),
    "",
    "NEXT 3 TRIAGE ITEMS:",
    ...triageItems.slice(0, 3).map((item) => `- ${item.title}: ${item.detail}`),
  ].join("\n");
}

function teamIntroText({ profile, matches }: { profile: BuilderProfile; matches: TeamMatch[] }) {
  return [
    `AABW team radar - ${profile.name}`,
    `Project: ${profile.project}`,
    `Looking for: ${profile.skillGaps.join(", ") || profile.priority.replace("-", " ")}`,
    `Can offer: ${profile.stack.join(", ") || "product feedback and build support"}`,
    "",
    "Suggested intros:",
    ...matches.map(
      (match, index) =>
        `${index + 1}. ${match.profile.name} (${match.score}%) - ${match.reasons.join("; ")}. Ask: ${match.ask}. Offer: ${match.offer}.`,
    ),
    "",
    "If you are nearby, reply with your role, stack, current venue, and the blocker you can help clear.",
  ].join("\n");
}

function progressUpdateText({
  profile,
  dayMeta,
  selectedTime,
  best,
  topTriageTitle,
  venueList,
}: {
  profile: BuilderProfile;
  dayMeta: (typeof eventDays)[number];
  selectedTime: string;
  best: EventBlock;
  topTriageTitle?: string;
  venueList: typeof mockVenues;
}) {
  return [
    `Building for the Builder Experience track: ${profile.project}`,
    "",
    `Current AABW context: ${dayMeta.label} ${dayMeta.theme}, ${selectedTime}`,
    `Recommended next move: ${best.title} at ${venueName(best.venueId, venueList)}`,
    topTriageTitle ? `Live blocker to clear: ${topTriageTitle}` : null,
    "",
    "AABW Next Move helps builders act faster, cut schedule/venue confusion, find the right mentor or perk, and protect Demo Day deadlines.",
  ]
    .filter(Boolean)
    .join("\n");
}

function devpostSummaryText({
  profile,
  best,
  venueList,
}: {
  profile: BuilderProfile;
  best: EventBlock;
  venueList: typeof mockVenues;
}) {
  return [
    "Project: AABW Next Move",
    "",
    "Tagline: A live AI copilot that helps Agentic AI Build Week builders decide what to do next across schedules, venues, mentors, perks, deadlines, and Demo Day.",
    "",
    `Target builder: ${profile.name}`,
    `Pain point: ${profile.project}`,
    `Demo moment: ${best.title} at ${venueName(best.venueId, venueList)}`,
    "",
    "Why it fits Builder Experience: It is a working live-event workflow, not a chatbot wrapper. It combines deterministic time/venue/deadline guardrails with AI explanations, retrieval over event data, venue maps, live triage, team matching, saved action plans, and copyable support/share outputs.",
  ].join("\n");
}

function calendarDate(day: EventDay) {
  const dateByDay: Record<EventDay, string> = {
    1: "20260708",
    2: "20260709",
    3: "20260710",
    4: "20260711",
    5: "20260712",
  };
  return dateByDay[day];
}

function calendarHoldText({
  profile,
  block,
  venueList,
}: {
  profile: BuilderProfile;
  block: EventBlock;
  venueList: typeof mockVenues;
}) {
  const date = calendarDate(block.day);
  const start = block.time.replace(":", "");
  const end = block.endTime.replace(":", "");
  const description = [
    `AABW Next Move recommendation for ${profile.name}.`,
    block.outcome,
    `Tags: ${block.tags.join(", ")}`,
  ].join("\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AABW Next Move//Builder Experience//EN",
    "BEGIN:VEVENT",
    `UID:${block.id}-${profile.id}@aabw-next-move`,
    `DTSTAMP:${date}T000000Z`,
    `DTSTART:${date}T${start}00`,
    `DTEND:${date}T${end}00`,
    `SUMMARY:${block.title}`,
    `LOCATION:${venueName(block.venueId, venueList)}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function NextMoveDashboard() {
  const [eventData, setEventData] = useState<EventDataPayload>(() => defaultEventData());
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [retrievalMatches, setRetrievalMatches] = useState<RetrievalMatch[]>([]);
  const [retrievalSource, setRetrievalSource] = useState<RetrievalPayload["source"]>("keyword");
  const [customProfiles, setCustomProfiles] = useState<BuilderProfile[]>([]);
  const [profileId, setProfileId] = useState(seedProfiles[0].id);
  const [selectedDay, setSelectedDay] = useState<EventDay>(2);
  const [selectedTime, setSelectedTime] = useState("10:30");
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [savedRecommendations, setSavedRecommendations] = useState<SavedRecommendation[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [hasLoadedRemoteChecklist, setHasLoadedRemoteChecklist] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);

  const allProfiles = useMemo(
    () => uniqueProfiles([...eventData.profiles, ...customProfiles]),
    [customProfiles, eventData.profiles],
  );
  const profile = allProfiles.find((item) => item.id === profileId) ?? allProfiles[0];
  const [draftProfile, setDraftProfile] = useState<DraftProfile>(() => toDraftProfile(profile));
  const dayMeta = eventDays.find((item) => item.day === selectedDay) ?? eventDays[0];
  const currentVenue = eventData.venues.find((venue) => venue.id === profile.currentVenue) ?? eventData.venues[0];

  const rec = useMemo(
    () => recommendation(eventData.schedule, profile, selectedDay, selectedTime),
    [eventData.schedule, profile, selectedDay, selectedTime],
  );
  const focusedBlock = useMemo(
    () => eventData.schedule.find((block) => block.id === focusedEventId && block.day === selectedDay) ?? rec.best,
    [eventData.schedule, focusedEventId, rec.best, selectedDay],
  );
  const resourceMatches = useMemo(
    () => relevantResources(eventData.resources, profile),
    [eventData.resources, profile],
  );
  const mentorMatches = useMemo(() => relevantMentors(eventData.mentors, profile), [eventData.mentors, profile]);
  const deadlineQueue = useMemo(
    () => activeDeadlines(eventData.deadlines, selectedDay),
    [eventData.deadlines, selectedDay],
  );
  const rankedBlocks = useMemo(
    () => rankedDayBlocks(eventData.schedule, profile, selectedDay, selectedTime),
    [eventData.schedule, profile, selectedDay, selectedTime],
  );
  const teamMatches = useMemo(() => recommendedTeamMatches(allProfiles, profile), [allProfiles, profile]);
  const triageItems = useMemo<TriageItem[]>(() => {
    const recommendedVenue = eventData.venues.find((venue) => venue.id === rec.best.venueId) ?? currentVenue;
    const topMentor = mentorMatches[0]?.mentor;
    const topResource = resourceMatches[0]?.resource;
    const topDeadline = deadlineQueue[0];
    const topTeamMatch = teamMatches[0];
    const shouldMove = rec.best.venueId !== profile.currentVenue;

    return [
      {
        id: `triage:venue:${rec.best.id}`,
        kind: "venue",
        title: shouldMove ? `Move to ${recommendedVenue.name}` : `Stay at ${recommendedVenue.name}`,
        detail: shouldMove
          ? `${recommendedVenue.travelNote} Leave before ${rec.best.time} for ${rec.best.title}.`
          : `Join ${rec.best.title} on site and confirm the room before it fills.`,
      },
      topMentor
        ? {
            id: `triage:mentor:${topMentor.id}`,
            kind: "mentor",
            title: `Ask ${topMentor.name}`,
            detail: `${topMentor.focus}. Best slot: ${topMentor.slot}.`,
          }
        : null,
      topResource
        ? {
            id: `triage:perk:${topResource.id}`,
            kind: "perk",
            title: `Use ${topResource.title}`,
            detail: topResource.action,
          }
        : null,
      topDeadline
        ? {
            id: `triage:deadline:${topDeadline.id}`,
            kind: "deadline",
            title: `Protect ${topDeadline.title}`,
            detail: `Day ${topDeadline.day}, ${topDeadline.time}. ${topDeadline.detail}`,
          }
        : null,
      topTeamMatch
        ? {
            id: `triage:team:${topTeamMatch.profile.id}`,
            kind: "team",
            title: `Talk to ${topTeamMatch.profile.name}`,
            detail: `${topTeamMatch.reasons.join("; ")}. ${topTeamMatch.ask}.`,
          }
        : null,
      {
        id: "triage:community-share",
        kind: "community",
        title: "Share progress in Discord",
        detail:
          "Post your next move, blocker, missing role, or support request so the community can route help faster.",
      },
    ].filter(Boolean) as TriageItem[];
  }, [
    currentVenue,
    deadlineQueue,
    eventData.venues,
    mentorMatches,
    profile.currentVenue,
    rec.best,
    resourceMatches,
    teamMatches,
  ]);
  const launchItems = useMemo<LaunchItem[]>(
    () => [
      {
        id: "launch:problem",
        title: "State the live builder pain point",
        detail: "Make the Devpost story start with schedule, venue, mentor, perk, and deadline confusion during AABW.",
      },
      {
        id: "launch:workflow",
        title: "Show the workflow, not a chatbot",
        detail:
          "Demo profile context, Next Move, venue map focus, live triage, Team Radar, saved plan, and copyable support request.",
      },
      {
        id: "launch:share",
        title: "Share a progress update",
        detail: "Post a concise update in Discord so other builders can understand, test, and vote.",
      },
      {
        id: "launch:deploy",
        title: "Explain live deployment fit",
        detail:
          "Call out self-contained public data, Supabase persistence, pgvector retrieval, and Vercel deployment path.",
      },
    ],
    [],
  );
  const actionItems = useMemo(
    () =>
      [
        `move:${rec.best.id}`,
        rec.next ? `next:${rec.next.id}` : "next:notes",
        "before-demo",
        ...deadlineQueue.map((deadline) => `deadline:${deadline.id}`),
        teamMatches.length ? "team:intro" : null,
        ...triageItems.map((item) => item.id),
        ...launchItems.map((item) => item.id),
      ].filter(Boolean) as string[],
    [deadlineQueue, launchItems, rec.best.id, rec.next, teamMatches.length, triageItems],
  );
  const readiness = Math.round(
    (actionItems.filter((item) => completedItems.includes(item)).length / Math.max(1, actionItems.length)) * 100,
  );
  const retrievalQuery = useMemo(
    () =>
      [
        profile.name,
        profile.project,
        `goals ${profile.goals.join(" ")}`,
        `stack ${profile.stack.join(" ")}`,
        `gaps ${profile.skillGaps.join(" ")}`,
        `priority ${profile.priority}`,
        `${dayMeta.label} ${dayMeta.theme} ${selectedTime}`,
        rec.best.title,
      ].join(" "),
    [dayMeta.label, dayMeta.theme, profile, rec.best.title, selectedTime],
  );
  const currentPlanText = useMemo(
    () =>
      actionPlanText({
        profile,
        dayMeta,
        selectedTime,
        best: rec.best,
        next: rec.next,
        explanation: aiInsight?.explanation ?? rec.explanation,
        deadlineTitle: deadlineQueue[0]?.title,
        triageItems,
        venueList: eventData.venues,
      }),
    [aiInsight?.explanation, dayMeta, deadlineQueue, eventData.venues, profile, rec, selectedTime, triageItems],
  );
  const supportRequest = useMemo(
    () =>
      supportRequestText({
        profile,
        dayMeta,
        selectedTime,
        best: rec.best,
        mentorName: mentorMatches[0]?.mentor.name,
        resourceTitle: resourceMatches[0]?.resource.title,
        deadlineTitle: deadlineQueue[0]?.title,
        venueList: eventData.venues,
      }),
    [dayMeta, deadlineQueue, eventData.venues, mentorMatches, profile, rec.best, resourceMatches, selectedTime],
  );
  const progressUpdate = useMemo(
    () =>
      progressUpdateText({
        profile,
        dayMeta,
        selectedTime,
        best: rec.best,
        topTriageTitle: triageItems[0]?.title,
        venueList: eventData.venues,
      }),
    [dayMeta, eventData.venues, profile, rec.best, selectedTime, triageItems],
  );
  const devpostSummary = useMemo(
    () =>
      devpostSummaryText({
        profile,
        best: rec.best,
        venueList: eventData.venues,
      }),
    [eventData.venues, profile, rec.best],
  );
  const eventSignals = useMemo(
    () =>
      liveEventSignals({
        best: rec.best,
        profile,
        day: selectedDay,
        selectedTime,
        currentVenue,
        venueList: eventData.venues,
        deadlineQueue,
        mentorName: mentorMatches[0]?.mentor.name,
        resourceTitle: resourceMatches[0]?.resource.title,
      }),
    [
      currentVenue,
      deadlineQueue,
      eventData.venues,
      mentorMatches,
      profile,
      rec.best,
      resourceMatches,
      selectedDay,
      selectedTime,
    ],
  );
  const onsiteBrief = useMemo(
    () =>
      onsiteBriefText({
        profile,
        dayMeta,
        selectedTime,
        best: rec.best,
        signals: eventSignals,
        triageItems,
        venueList: eventData.venues,
      }),
    [dayMeta, eventData.venues, eventSignals, profile, rec.best, selectedTime, triageItems],
  );
  const teamIntro = useMemo(() => teamIntroText({ profile, matches: teamMatches }), [profile, teamMatches]);

  useEffect(() => {
    const storedProfiles = readJson<BuilderProfile[]>(customProfilesKey, []);
    const storedCompleted = readJson<string[]>(completedItemsKey, []);
    const storedState = readJson<SavedState>(selectedStateKey, {
      profileId: seedProfiles[0].id,
      selectedDay: 2,
      selectedTime: "10:30",
    });
    const storedSessionId = window.localStorage.getItem(sessionIdKey) ?? createSessionId();
    window.localStorage.setItem(sessionIdKey, storedSessionId);

    setCustomProfiles(storedProfiles);
    setCompletedItems(storedCompleted);
    setProfileId(storedState.profileId);
    setSelectedDay(storedState.selectedDay);
    setSelectedTime(storedState.selectedTime);
    setSessionId(storedSessionId);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    let isActive = true;

    fetch("/api/event-data")
      .then((response) => response.json() as Promise<EventDataPayload>)
      .then((payload) => {
        if (!isActive) return;
        setEventData(payload);
        if (payload.source === "supabase") {
          toast.success("Loaded event data from Supabase");
        }
      })
      .catch(() => {
        if (!isActive) return;
        setEventData(defaultEventData());
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    fetch("/api/retrieval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: retrievalQuery, matchCount: 5 }),
    })
      .then((response) => response.json() as Promise<RetrievalPayload>)
      .then((payload) => {
        if (!isActive) return;
        setRetrievalMatches(payload.matches ?? []);
        setRetrievalSource(payload.source ?? "keyword");
      })
      .catch(() => {
        if (!isActive) return;
        setRetrievalMatches([]);
        setRetrievalSource("keyword");
      });

    return () => {
      isActive = false;
    };
  }, [retrievalQuery]);

  useEffect(() => {
    let isActive = true;
    setAiInsight(null);

    fetch("/api/ai/next-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile,
        day: `${dayMeta.label} - ${dayMeta.theme}`,
        selectedTime,
        best: {
          title: rec.best.title,
          time: rec.best.time,
          endTime: rec.best.endTime,
          venue: venueName(rec.best.venueId, eventData.venues),
          outcome: rec.best.outcome,
          tags: rec.best.tags,
        },
        next: rec.next
          ? {
              title: rec.next.title,
              time: rec.next.time,
              endTime: rec.next.endTime,
              venue: venueName(rec.next.venueId, eventData.venues),
            }
          : undefined,
        deadlineTitle: deadlineQueue[0]?.title,
        retrievalContext: retrievalMatches.slice(0, 4).map((match) => ({
          title: match.title,
          body: match.body,
          sourceType: match.sourceType,
          similarity: match.similarity,
        })),
        deterministicExplanation: rec.explanation,
      }),
    })
      .then((response) => response.json() as Promise<AiInsight>)
      .then((payload) => {
        if (!isActive) return;
        setAiInsight(payload);
      })
      .catch(() => {
        if (!isActive) return;
        setAiInsight({
          source: "deterministic",
          explanation: rec.explanation,
          now: "Use the ranked recommendation and venue context.",
          next: rec.next ? `Afterward, consider ${rec.next.title}.` : "Capture notes and update your README.",
          beforeDemo: deadlineQueue[0]?.title ?? "Keep a fallback demo video and seeded data ready.",
          risk: "AI route unavailable.",
        });
      });

    return () => {
      isActive = false;
    };
  }, [dayMeta.label, dayMeta.theme, deadlineQueue, eventData.venues, profile, rec, retrievalMatches, selectedTime]);

  useEffect(() => {
    setDraftProfile(toDraftProfile(profile));
  }, [profile]);

  useEffect(() => {
    setFocusedEventId(rec.best.id);
  }, [rec.best.id]);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(customProfilesKey, JSON.stringify(customProfiles));
  }, [customProfiles, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(completedItemsKey, JSON.stringify(completedItems));
  }, [completedItems, isHydrated]);

  useEffect(() => {
    if (!isHydrated || !sessionId) return;
    let isActive = true;

    fetch(`/api/checklist?sessionId=${encodeURIComponent(sessionId)}`)
      .then((response) => response.json() as Promise<{ completedItems: string[]; persisted: boolean }>)
      .then((payload) => {
        if (!isActive) return;
        if (payload.persisted && payload.completedItems.length > 0) {
          setCompletedItems((current) => Array.from(new Set([...current, ...payload.completedItems])));
        }
        setHasLoadedRemoteChecklist(true);
      })
      .catch(() => {
        if (!isActive) return;
        setHasLoadedRemoteChecklist(true);
      });

    return () => {
      isActive = false;
    };
  }, [isHydrated, sessionId]);

  useEffect(() => {
    if (!isHydrated || !sessionId) return;
    let isActive = true;

    fetch(`/api/recommendations?sessionId=${encodeURIComponent(sessionId)}`)
      .then((response) => response.json() as Promise<{ persisted: boolean; recommendations: SavedRecommendation[] }>)
      .then((payload) => {
        if (!isActive) return;
        if (payload.persisted) {
          setSavedRecommendations(payload.recommendations);
        }
      })
      .catch(() => {
        if (!isActive) return;
        setSavedRecommendations([]);
      });

    return () => {
      isActive = false;
    };
  }, [isHydrated, sessionId]);

  useEffect(() => {
    if (!isHydrated || !sessionId || !hasLoadedRemoteChecklist) return;

    fetch("/api/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        items: actionItems.map((id) => ({ id, completed: completedItems.includes(id) })),
      }),
    }).catch(() => {
      // Local storage remains the offline fallback when Supabase is unavailable.
    });
  }, [actionItems, completedItems, hasLoadedRemoteChecklist, isHydrated, sessionId]);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(selectedStateKey, JSON.stringify({ profileId, selectedDay, selectedTime }));
  }, [isHydrated, profileId, selectedDay, selectedTime]);

  const toggleCompleted = (id: string) => {
    setCompletedItems((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const saveDraftProfile = async () => {
    const nextProfile = fromDraftProfile(draftProfile);
    const isCustomProfile = nextProfile.id.startsWith("custom-");
    const id = isCustomProfile ? nextProfile.id : `custom-${Date.now()}`;
    const savedProfile = {
      ...nextProfile,
      id,
      name: nextProfile.name,
    };

    setCustomProfiles((current) => {
      const exists = current.some((item) => item.id === id);
      return exists ? current.map((item) => (item.id === id ? savedProfile : item)) : [...current, savedProfile];
    });
    setProfileId(id);

    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savedProfile),
      });
      const payload = (await response.json()) as { persisted: boolean; profile?: BuilderProfile; reason?: string };
      if (payload.persisted && payload.profile) {
        const persistedProfile = payload.profile;
        setCustomProfiles((current) => current.map((item) => (item.id === id ? persistedProfile : item)));
        toast.success("Builder profile saved to Supabase");
      } else {
        toast.info(payload.reason ? `Saved locally: ${payload.reason}` : "Saved locally");
      }
    } catch {
      toast.info("Saved locally. Supabase profile sync is unavailable.");
    }
  };

  const resetWorkspace = () => {
    const nextSessionId = createSessionId();
    setCustomProfiles([]);
    setCompletedItems([]);
    setSavedRecommendations([]);
    setProfileId(seedProfiles[0].id);
    setSelectedDay(2);
    setSelectedTime("10:30");
    setSessionId(nextSessionId);
    setHasLoadedRemoteChecklist(true);
    window.localStorage.removeItem(customProfilesKey);
    window.localStorage.removeItem(completedItemsKey);
    window.localStorage.removeItem(selectedStateKey);
    window.localStorage.setItem(sessionIdKey, nextSessionId);
    toast.success("Demo workspace reset");
  };

  const copyPlan = async () => {
    try {
      await navigator.clipboard.writeText(currentPlanText);
      toast.success("Action plan copied");
    } catch {
      toast.error("Could not copy action plan");
    }
  };

  const copySupportRequest = async () => {
    try {
      await navigator.clipboard.writeText(supportRequest);
      toast.success("Support request copied");
    } catch {
      toast.error("Could not copy support request");
    }
  };

  const copyProgressUpdate = async () => {
    try {
      await navigator.clipboard.writeText(progressUpdate);
      toast.success("Progress update copied");
    } catch {
      toast.error("Could not copy progress update");
    }
  };

  const copyDevpostSummary = async () => {
    try {
      await navigator.clipboard.writeText(devpostSummary);
      toast.success("Devpost summary copied");
    } catch {
      toast.error("Could not copy Devpost summary");
    }
  };

  const copyOnsiteBrief = async () => {
    try {
      await navigator.clipboard.writeText(onsiteBrief);
      toast.success("Event brief copied");
    } catch {
      toast.error("Could not copy event brief");
    }
  };

  const copyTeamIntro = async () => {
    try {
      await navigator.clipboard.writeText(teamIntro);
      toast.success("Team intro copied");
    } catch {
      toast.error("Could not copy team intro");
    }
  };

  const downloadCalendarHold = () => {
    const blob = new Blob([calendarHoldText({ profile, block: rec.best, venueList: eventData.venues })], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aabw-next-move-${rec.best.id}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Calendar hold downloaded");
  };

  const savePlan = async () => {
    if (!sessionId) {
      toast.error("Session is not ready yet");
      return;
    }

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          profileId: profile.id,
          profileName: profile.name,
          day: `${dayMeta.label} - ${dayMeta.theme}`,
          selectedTime,
          title: rec.best.title,
          venue: venueName(rec.best.venueId, eventData.venues),
          planText: currentPlanText,
          aiSource: aiInsight?.source ?? "deterministic",
          retrievalSource,
          matchScore: rec.score,
        }),
      });
      const payload = (await response.json()) as {
        persisted: boolean;
        recommendation?: SavedRecommendation;
        reason?: string;
      };

      if (payload.persisted && payload.recommendation) {
        setSavedRecommendations((current) => [payload.recommendation as SavedRecommendation, ...current].slice(0, 8));
        toast.success("Action plan saved");
      } else {
        toast.error(payload.reason ?? "Could not save action plan");
      }
    } catch {
      toast.error("Could not save action plan");
    }
  };

  const deleteSavedPlan = async (id: string) => {
    setSavedRecommendations((current) => current.filter((item) => item.id !== id));

    try {
      const response = await fetch("/api/recommendations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, sessionId }),
      });
      const payload = (await response.json()) as { persisted: boolean; reason?: string };
      if (!payload.persisted) {
        toast.error(payload.reason ?? "Could not delete saved plan");
      }
    } catch {
      toast.error("Could not delete saved plan");
    }
  };

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Card className="bg-linear-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <span className="flex size-8 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                <Compass className="size-4" />
              </span>
              AABW Next Move
            </CardTitle>
            <CardDescription>
              Live event copilot for deciding where to go, who to meet, and what to do next.
            </CardDescription>
            <CardAction>
              <div className="flex flex-wrap justify-end gap-2">
                <Badge variant="secondary">{eventData.source === "supabase" ? "Supabase live" : "Mock fallback"}</Badge>
                <Badge variant="outline">{aiInsight?.source === "openai" ? "OpenAI on" : "AI fallback"}</Badge>
                <Badge variant="outline">{retrievalSource === "pgvector" ? "pgvector" : "keyword RAG"}</Badge>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-background/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-muted-foreground text-xs">
                <Users className="size-3.5" />
                Builder profile
              </div>
              <div className="flex flex-wrap gap-2">
                {allProfiles.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    size="sm"
                    variant={item.id === profileId ? "default" : "outline"}
                    onClick={() => setProfileId(item.id)}
                  >
                    {item.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-background/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-muted-foreground text-xs">
                <CalendarClock className="size-3.5" />
                Event day
              </div>
              <div className="flex flex-wrap gap-2">
                {eventDays.map((item) => (
                  <Button
                    key={item.day}
                    type="button"
                    size="sm"
                    variant={item.day === selectedDay ? "default" : "outline"}
                    onClick={() => setSelectedDay(item.day)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-background/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-muted-foreground text-xs">
                <Clock3 className="size-3.5" />
                Current time
              </div>
              <div className="flex flex-wrap gap-2">
                {demoTimes.map((time) => (
                  <Button
                    key={time}
                    type="button"
                    size="sm"
                    variant={time === selectedTime ? "default" : "outline"}
                    onClick={() => setSelectedTime(time)}
                  >
                    {time}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Builder context</CardTitle>
            <CardDescription>{profile.project}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{profile.track}</Badge>
              <Badge variant="outline">{profile.priority.replace("-", " ")}</Badge>
              <Badge variant="outline">{currentVenue.name}</Badge>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <SignalList title="Goals" values={profile.goals} />
              <SignalList title="Stack" values={profile.stack} />
              <SignalList title="Gaps" values={profile.skillGaps} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
        <MetricCard
          icon={Gauge}
          label="Match confidence"
          value={`${rec.score}%`}
          detail={aiInsight?.explanation ?? rec.explanation}
        />
        <MetricCard icon={MapPin} label="Current venue" value={currentVenue.area} detail={currentVenue.travelNote} />
        <MetricCard
          icon={ClipboardCheck}
          label="Run readiness"
          value={`${readiness}%`}
          detail={`${actionItems.filter((item) => completedItems.includes(item)).length}/${actionItems.length} actions done`}
        />
        <MetricCard
          icon={Sparkles}
          label="Relevant perks"
          value={String(resourceMatches.length)}
          detail={resourceMatches[0]?.resource.title ?? "No resource match yet"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-primary/20 bg-linear-to-t from-primary/10 to-card shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ArrowRight className="size-4" />
              </span>
              Next move
            </CardTitle>
            <CardDescription>
              {dayMeta.label} - {dayMeta.theme} - {dayMeta.date} at {selectedTime}
            </CardDescription>
            <CardAction className="flex items-center gap-2">
              <Badge>{rec.best.type}</Badge>
              <Button size="sm" variant="outline" type="button" onClick={savePlan}>
                <Save className="size-3.5" />
                Save plan
              </Button>
              <Button size="sm" variant="outline" type="button" onClick={copyPlan}>
                <ClipboardCopy className="size-3.5" />
                Copy plan
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="rounded-xl border bg-background/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-muted-foreground text-sm">
                    {rec.best.time}-{rec.best.endTime} at {venueName(rec.best.venueId, eventData.venues)}
                  </div>
                  <h2 className="mt-1 font-heading font-medium text-2xl tracking-tight">{rec.best.title}</h2>
                  <p className="mt-2 max-w-2xl text-muted-foreground text-sm">{rec.best.outcome}</p>
                </div>
                <Badge
                  variant={rec.best.capacity === "nearly-full" ? "destructive" : "secondary"}
                  className="capitalize"
                >
                  {rec.best.capacity.replace("-", " ")}
                </Badge>
              </div>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">AI match signal</span>
                  <span className="font-medium">{rec.score}%</span>
                </div>
                <Progress value={rec.score} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <ActionStep
                id={`move:${rec.best.id}`}
                checked={completedItems.includes(`move:${rec.best.id}`)}
                title="Now"
                icon={Route}
                onCheckedChange={toggleCompleted}
                detail={
                  aiInsight?.now ??
                  (rec.best.venueId === profile.currentVenue
                    ? "Stay on site and join the room before it fills."
                    : `Leave for ${venueName(rec.best.venueId, eventData.venues)} and budget travel time.`)
                }
              />
              <ActionStep
                id={rec.next ? `next:${rec.next.id}` : "next:notes"}
                checked={completedItems.includes(rec.next ? `next:${rec.next.id}` : "next:notes")}
                title="Next"
                icon={Lightbulb}
                onCheckedChange={toggleCompleted}
                detail={
                  aiInsight?.next ??
                  (rec.next ? `Afterward, consider ${rec.next.title}.` : "Capture notes and update your README.")
                }
              />
              <ActionStep
                id="before-demo"
                checked={completedItems.includes("before-demo")}
                title="Before demo"
                icon={BadgeCheck}
                onCheckedChange={toggleCompleted}
                detail={
                  aiInsight?.beforeDemo ??
                  deadlineQueue[0]?.detail ??
                  "Keep a fallback demo video and seeded data ready."
                }
              />
            </div>
          </CardContent>
        </Card>

        <ProfileBuilder
          draft={draftProfile}
          customProfileCount={customProfiles.length}
          onDraftChange={setDraftProfile}
          onSave={saveDraftProfile}
          onReset={resetWorkspace}
          venues={eventData.venues}
          starterProfile={seedProfiles[0]}
        />
      </div>

      <EventModePanel
        best={rec.best}
        currentVenue={currentVenue}
        selectedTime={selectedTime}
        signals={eventSignals}
        venueList={eventData.venues}
        onCopyBrief={copyOnsiteBrief}
        onDownloadCalendar={downloadCalendarHold}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <LiveTriage
          items={triageItems}
          completedItems={completedItems}
          onToggle={toggleCompleted}
          onCopySupport={copySupportRequest}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              Venue map
            </CardTitle>
            <CardDescription>
              Focused on {focusedBlock.title} at {venueName(focusedBlock.venueId, eventData.venues)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <VenueMap
              venues={eventData.venues}
              currentVenueId={profile.currentVenue}
              recommendedVenueId={rec.best.venueId}
              focusedVenueId={focusedBlock.venueId}
              focusedEventTitle={focusedBlock.title}
            />
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="default">Focused event</Badge>
              <Badge variant="outline">Recommended move</Badge>
              <Badge variant="secondary">Current venue</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Semantic retrieval</CardTitle>
            <CardDescription>
              {retrievalSource === "pgvector"
                ? "Matches retrieved from Supabase pgvector."
                : "Keyword fallback until event document embeddings are seeded."}
            </CardDescription>
            <CardAction>
              <Badge variant={retrievalSource === "pgvector" ? "default" : "outline"}>{retrievalSource}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {retrievalMatches.slice(0, 4).map((match) => (
              <div key={match.id} className="rounded-lg border bg-background/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{match.title}</div>
                    <div className="mt-1 line-clamp-2 text-muted-foreground text-sm">{match.body}</div>
                  </div>
                  <Badge variant="outline">{match.sourceType}</Badge>
                </div>
                <div className="mt-2 text-muted-foreground text-xs">
                  similarity {Math.round(match.similarity * 100)}%
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Daily runbook</CardTitle>
            <CardDescription>Top moves ranked by context, timing, venue, and urgency.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rankedBlocks.map(({ block, score }, index) => (
              <ScheduleRow
                key={block.id}
                block={block}
                score={score}
                rank={index + 1}
                focused={block.id === focusedBlock.id}
                selected={block.id === rec.best.id}
                venues={eventData.venues}
                onFocus={() => setFocusedEventId(block.id)}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resources and perks</CardTitle>
            <CardDescription>Matched to the project profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {resourceMatches.map(({ resource, score }) => (
              <div key={resource.id} className="rounded-lg border bg-background/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{resource.title}</div>
                    <div className="text-muted-foreground text-sm">{resource.partner}</div>
                  </div>
                  <Badge variant="outline">{resource.type}</Badge>
                </div>
                <p className="mt-2 text-muted-foreground text-sm">{resource.action}</p>
                <div className="mt-3 flex items-center gap-2 text-muted-foreground text-xs">
                  <Sparkles className="size-3.5" />
                  {score} matching signals
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <TeamRadar
          matches={teamMatches}
          checked={completedItems.includes("team:intro")}
          onToggle={() => toggleCompleted("team:intro")}
          onCopyIntro={copyTeamIntro}
        />

        <Card>
          <CardHeader>
            <CardTitle>Mentors and deadlines</CardTitle>
            <CardDescription>People and milestones to act on.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {mentorMatches.map(({ mentor }) => (
                <div key={mentor.id} className="rounded-lg border bg-background/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{mentor.name}</div>
                      <div className="text-muted-foreground text-sm">{mentor.focus}</div>
                    </div>
                    <Badge variant="secondary">{mentor.slot}</Badge>
                  </div>
                  <div className="mt-2 text-muted-foreground text-xs">
                    {venueName(mentor.venueId, eventData.venues)}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {deadlineQueue.map((deadline) => {
                const id = `deadline:${deadline.id}`;
                const isChecked = completedItems.includes(id);
                return (
                  <div
                    key={deadline.id}
                    className="flex gap-3 rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                  >
                    <Checkbox
                      aria-label={`Mark ${deadline.title} complete`}
                      checked={isChecked}
                      onCheckedChange={() => toggleCompleted(id)}
                    />
                    <Flag
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        deadline.severity === "critical" ? "text-destructive" : "text-primary",
                      )}
                    />
                    <span className="min-w-0">
                      <span className={cn("block font-medium text-sm", isChecked && "line-through opacity-60")}>
                        Day {deadline.day}, {deadline.time}: {deadline.title}
                      </span>
                      <span className="block text-muted-foreground text-xs">{deadline.detail}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <LaunchKit
          items={launchItems}
          completedItems={completedItems}
          onToggle={toggleCompleted}
          onCopyProgress={copyProgressUpdate}
          onCopyDevpost={copyDevpostSummary}
        />

        <SavedPlans recommendations={savedRecommendations} onDelete={deleteSavedPlan} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Why this helps builders</CardTitle>
          <CardDescription>Live workflow output, not a plain chat response.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Act faster with one recommended move for the current day and time.",
            "Cut confusion across venues, workshops, teammates, deadlines, mentors, and perks.",
            "Get more out of the week with a live triage checklist and support request.",
            "Stay self-contained with public or seeded data, ready for live AABW integration.",
          ].map((item) => (
            <div key={item} className="flex gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{item}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SignalList({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <div className="mb-1 text-muted-foreground text-xs">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <Badge key={value} variant="outline">
            {value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function EventModePanel({
  best,
  currentVenue,
  selectedTime,
  signals,
  venueList,
  onCopyBrief,
  onDownloadCalendar,
}: {
  best: EventBlock;
  currentVenue: Venue;
  selectedTime: string;
  signals: EventModeSignal[];
  venueList: typeof mockVenues;
  onCopyBrief: () => void;
  onDownloadCalendar: () => void;
}) {
  const minutesUntil = toMinutes(best.time) - toMinutes(selectedTime);
  const recommendedVenue = venueName(best.venueId, venueList);
  const hasCriticalRisk = signals.some((signal) => signal.level === "critical");

  return (
    <Card className="overflow-hidden border-primary/20 bg-linear-to-r from-primary/10 via-card to-card shadow-xs">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <span className="flex size-8 items-center justify-center rounded-lg border bg-background text-primary">
            <RadioTower className="size-4" />
          </span>
          Event mode
        </CardTitle>
        <CardDescription>
          Fast on-site command view for movement, support, and deadline risk before the next session.
        </CardDescription>
        <CardAction className="flex flex-wrap gap-2">
          <Badge variant={hasCriticalRisk ? "destructive" : "secondary"}>
            {hasCriticalRisk ? "risk now" : "on track"}
          </Badge>
          <Badge variant="outline">{formatMinuteDelta(minutesUntil)}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border bg-background/70 p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <AlarmClockCheck className="size-3.5" />
            Room-ready decision
          </div>
          <div className="mt-2 font-heading font-medium text-2xl tracking-tight">{best.title}</div>
          <p className="mt-2 text-muted-foreground text-sm">
            {best.time}-{best.endTime} at {recommendedVenue}. Current base: {currentVenue.name}.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button type="button" onClick={onCopyBrief}>
              <ClipboardCopy className="size-3.5" />
              Copy event brief
            </Button>
            <Button type="button" variant="outline" onClick={onDownloadCalendar}>
              <CalendarPlus className="size-3.5" />
              Add calendar hold
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {signals.map((signal) => (
            <div
              key={signal.id}
              className={cn(
                "rounded-lg border bg-background/70 p-4",
                signal.level === "critical" && "border-destructive/40 bg-destructive/5",
                signal.level === "watch" && "border-primary/30 bg-primary/5",
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-medium text-sm">
                  {signal.level === "critical" ? (
                    <AlertTriangle className="size-4 text-destructive" />
                  ) : signal.level === "watch" ? (
                    <ShieldCheck className="size-4 text-primary" />
                  ) : (
                    <CheckCircle2 className="size-4 text-primary" />
                  )}
                  {signal.title}
                </div>
                <Badge
                  variant={
                    signal.level === "critical" ? "destructive" : signal.level === "watch" ? "outline" : "secondary"
                  }
                  className="capitalize"
                >
                  {signal.level}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">{signal.detail}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LiveTriage({
  items,
  completedItems,
  onToggle,
  onCopySupport,
}: {
  items: TriageItem[];
  completedItems: string[];
  onToggle: (id: string) => void;
  onCopySupport: () => void;
}) {
  const completedCount = items.filter((item) => completedItems.includes(item.id)).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-primary" />
          Live triage
        </CardTitle>
        <CardDescription>
          Builder pain points to clear before the next venue, mentor, perk, or deadline.
        </CardDescription>
        <CardAction>
          <Badge variant="outline">
            {completedCount}/{items.length} cleared
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const isChecked = completedItems.includes(item.id);
          return (
            <div key={item.id} className="flex gap-3 rounded-lg border bg-background/60 p-3">
              <Checkbox
                aria-label={`Mark ${item.title} complete`}
                checked={isChecked}
                onCheckedChange={() => onToggle(item.id)}
              />
              <span className="min-w-0">
                <span className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={cn("font-medium text-sm", isChecked && "line-through opacity-60")}>
                    {item.title}
                  </span>
                  <Badge variant="secondary" className="capitalize">
                    {item.kind}
                  </Badge>
                </span>
                <span className="block text-muted-foreground text-sm">{item.detail}</span>
              </span>
            </div>
          );
        })}
        <Button type="button" variant="outline" className="w-full" onClick={onCopySupport}>
          <ClipboardCopy className="size-3.5" />
          Copy help request
        </Button>
      </CardContent>
    </Card>
  );
}

function LaunchKit({
  items,
  completedItems,
  onToggle,
  onCopyProgress,
  onCopyDevpost,
}: {
  items: LaunchItem[];
  completedItems: string[];
  onToggle: (id: string) => void;
  onCopyProgress: () => void;
  onCopyDevpost: () => void;
}) {
  const completedCount = items.filter((item) => completedItems.includes(item.id)).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4 text-primary" />
          Launch kit
        </CardTitle>
        <CardDescription>Submission and community-vote readiness for the Builder Experience track.</CardDescription>
        <CardAction>
          <Badge variant="outline">
            {completedCount}/{items.length} ready
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const isChecked = completedItems.includes(item.id);
          return (
            <div key={item.id} className="flex gap-3 rounded-lg border bg-background/60 p-3">
              <Checkbox
                aria-label={`Mark ${item.title} ready`}
                checked={isChecked}
                onCheckedChange={() => onToggle(item.id)}
              />
              <span className="min-w-0">
                <span className={cn("block font-medium text-sm", isChecked && "line-through opacity-60")}>
                  {item.title}
                </span>
                <span className="mt-1 block text-muted-foreground text-sm">{item.detail}</span>
              </span>
            </div>
          );
        })}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={onCopyProgress}>
            <ClipboardCopy className="size-3.5" />
            Copy progress update
          </Button>
          <Button type="button" variant="outline" onClick={onCopyDevpost}>
            <ClipboardCopy className="size-3.5" />
            Copy Devpost summary
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamRadar({
  matches,
  checked,
  onToggle,
  onCopyIntro,
}: {
  matches: TeamMatch[];
  checked: boolean;
  onToggle: () => void;
  onCopyIntro: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Handshake className="size-4 text-primary" />
          Team radar
        </CardTitle>
        <CardDescription>Find nearby collaborators who can cover gaps and receive help back.</CardDescription>
        <CardAction>
          <Badge variant="outline">{matches.length} matches</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
          <Checkbox aria-label="Mark team intro sent" checked={checked} onCheckedChange={onToggle} />
          <span className="min-w-0">
            <span className={cn("block font-medium text-sm", checked && "line-through opacity-60")}>
              Send one targeted team intro
            </span>
            <span className="mt-1 block text-muted-foreground text-sm">
              Use the suggested ask/offer language to find teammates without posting a vague request.
            </span>
          </span>
        </div>

        {matches.map((match) => (
          <div key={match.profile.id} className="rounded-lg border bg-background/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{match.profile.name}</div>
                <div className="mt-1 line-clamp-2 text-muted-foreground text-sm">{match.profile.project}</div>
              </div>
              <Badge variant={match.score >= 80 ? "default" : "outline"}>{match.score}%</Badge>
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-md bg-muted/40 p-2">
                <span className="block text-muted-foreground text-xs">Ask</span>
                {match.ask}
              </div>
              <div className="rounded-md bg-muted/40 p-2">
                <span className="block text-muted-foreground text-xs">Offer</span>
                {match.offer}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {match.reasons.map((reason) => (
                <Badge key={reason} variant="secondary">
                  {reason}
                </Badge>
              ))}
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" className="w-full" onClick={onCopyIntro}>
          <ClipboardCopy className="size-3.5" />
          Copy team intro
        </Button>
      </CardContent>
    </Card>
  );
}

function SavedPlans({
  recommendations,
  onDelete,
}: {
  recommendations: SavedRecommendation[];
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved plans</CardTitle>
        <CardDescription>Session history for action plans saved during the event.</CardDescription>
        <CardAction>
          <Badge variant="outline">{recommendations.length} saved</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-muted-foreground text-sm">
            Save a plan to keep the current recommendation for later review.
          </div>
        ) : (
          recommendations.map((item) => (
            <div key={item.id} className="rounded-lg border bg-background/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{item.title}</div>
                  <div className="mt-1 text-muted-foreground text-xs">
                    {item.day} at {item.selectedTime} - {item.venue}
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  aria-label={`Delete saved plan ${item.title}`}
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <p className="mt-2 line-clamp-2 text-muted-foreground text-sm">{item.planText}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{item.matchScore}%</Badge>
                <Badge variant="outline">{item.aiSource}</Badge>
                <Badge variant="outline">{item.retrievalSource}</Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </div>
        </CardTitle>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">{value}</div>
        <p className="line-clamp-2 text-muted-foreground text-sm">{detail}</p>
      </CardContent>
    </Card>
  );
}

function VenueMap({
  venues,
  currentVenueId,
  recommendedVenueId,
  focusedVenueId,
  focusedEventTitle,
}: {
  venues: Venue[];
  currentVenueId: string;
  recommendedVenueId: string;
  focusedVenueId: string;
  focusedEventTitle: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || venues.length === 0) return;

    let isActive = true;
    let map: import("leaflet").Map | undefined;

    void import("leaflet").then((L) => {
      if (!isActive || !containerRef.current) return;

      const center =
        venues.find((venue) => venue.id === focusedVenueId) ??
        venues.find((venue) => venue.id === recommendedVenueId) ??
        venues.find((venue) => venue.id === currentVenueId) ??
        venues[0];

      map = L.map(containerRef.current, {
        attributionControl: true,
        scrollWheelZoom: false,
      }).setView([center.lat, center.lng], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      let focusedMarker: import("leaflet").Marker | undefined;

      for (const venue of venues) {
        const isCurrent = venue.id === currentVenueId;
        const isRecommended = venue.id === recommendedVenueId;
        const isFocused = venue.id === focusedVenueId;
        const color = isFocused
          ? "hsl(var(--primary))"
          : isRecommended
            ? "hsl(var(--chart-1))"
            : isCurrent
              ? "hsl(var(--chart-2))"
              : "hsl(var(--muted-foreground))";
        const markerSize = isFocused ? 24 : 18;
        const label = isFocused
          ? `Focused event: ${focusedEventTitle}`
          : isRecommended
            ? "Recommended move"
            : isCurrent
              ? "Current venue"
              : "Venue";

        const marker = L.marker([venue.lat, venue.lng], {
          icon: L.divIcon({
            className: "",
            html: `<span style="display:block;width:${markerSize}px;height:${markerSize}px;border-radius:999px;background:${color};border:3px solid hsl(var(--background));box-shadow:0 6px 18px rgba(0,0,0,.24)"></span>`,
            iconAnchor: [markerSize / 2, markerSize / 2],
            iconSize: [markerSize, markerSize],
          }),
        })
          .addTo(map)
          .bindPopup(
            `<strong>${escapeHtml(venue.name)}</strong><br/><span>${escapeHtml(label)}</span><br/>${escapeHtml(
              venue.travelNote,
            )}`,
          );

        if (isFocused) {
          focusedMarker = marker;
        }
      }

      window.setTimeout(() => {
        map?.invalidateSize();
        focusedMarker?.openPopup();
      }, 0);
    });

    return () => {
      isActive = false;
      map?.remove();
    };
  }, [currentVenueId, focusedEventTitle, focusedVenueId, recommendedVenueId, venues]);

  return <div ref={containerRef} className="h-72 overflow-hidden rounded-lg border bg-muted" />;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ActionStep({
  id,
  checked,
  title,
  detail,
  icon: Icon,
  onCheckedChange,
}: {
  id: string;
  checked: boolean;
  title: string;
  detail: string;
  icon: typeof Route;
  onCheckedChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-3 rounded-lg border bg-background/60 p-3 transition-colors hover:bg-muted/40">
      <Checkbox aria-label={`Mark ${title} complete`} checked={checked} onCheckedChange={() => onCheckedChange(id)} />
      <span className="min-w-0">
        <span className="mb-2 flex items-center gap-2 font-medium text-sm">
          <Icon className="size-4 text-primary" />
          {title}
        </span>
        <span className={cn("block text-muted-foreground text-sm", checked && "line-through opacity-60")}>
          {detail}
        </span>
      </span>
    </div>
  );
}

function ScheduleRow({
  block,
  focused,
  selected,
  rank,
  score,
  venues,
  onFocus,
}: {
  block: EventBlock;
  focused: boolean;
  selected: boolean;
  rank: number;
  score: number;
  venues: typeof mockVenues;
  onFocus: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={focused}
      onClick={onFocus}
      className={cn(
        "w-full rounded-lg border bg-background/60 p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary/40 bg-primary/5",
        focused && "ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-muted-foreground text-xs">
            #{rank} - {block.time}-{block.endTime} - {venueName(block.venueId, venues)}
          </div>
          <div className="mt-1 font-medium">{block.title}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={selected ? "default" : "outline"}>{selected ? "next" : block.type}</Badge>
          {focused && <Badge variant="secondary">map</Badge>}
          <span className="text-muted-foreground text-xs">{score}%</span>
        </div>
      </div>
      <p className="mt-2 text-muted-foreground text-sm">{block.outcome}</p>
    </button>
  );
}

function ProfileBuilder({
  draft,
  customProfileCount,
  venues,
  starterProfile,
  onDraftChange,
  onSave,
  onReset,
}: {
  draft: DraftProfile;
  customProfileCount: number;
  venues: typeof mockVenues;
  starterProfile: BuilderProfile;
  onDraftChange: (profile: DraftProfile) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
}) {
  const updateDraft = (updates: Partial<DraftProfile>) => onDraftChange({ ...draft, ...updates });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pencil className="size-4 text-primary" />
          Builder profile builder
        </CardTitle>
        <CardDescription>Create a team context and keep it for the next visit.</CardDescription>
        <CardAction>
          <Badge variant="outline">{customProfileCount} saved</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="builder-name">Team or builder name</Label>
            <Input
              id="builder-name"
              value={draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select
              value={draft.priority}
              onValueChange={(value) => updateDraft({ priority: value as BuilderProfile["priority"] })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="learn">Learn</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
                <SelectItem value="find-team">Find team</SelectItem>
                <SelectItem value="prepare-demo">Prepare demo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="project">Project</Label>
          <Textarea
            id="project"
            value={draft.project}
            onChange={(event) => updateDraft({ project: event.target.value })}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Current venue</Label>
            <Select value={draft.currentVenue} onValueChange={(value) => updateDraft({ currentVenue: value })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SignalField
            id="goals"
            label="Goals"
            value={draft.goals}
            onChange={(value) => updateDraft({ goals: value })}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <SignalField
            id="stack"
            label="Stack"
            value={draft.stack}
            onChange={(value) => updateDraft({ stack: value })}
          />
          <SignalField
            id="skill-gaps"
            label="Skill gaps"
            value={draft.skillGaps}
            onChange={(value) => updateDraft({ skillGaps: value })}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onSave}>
            <Save className="size-3.5" />
            Save profile
          </Button>
          <Button type="button" variant="outline" onClick={() => onDraftChange(toDraftProfile(starterProfile))}>
            <UserPlus className="size-3.5" />
            Starter profile
          </Button>
          <Button type="button" variant="destructive" onClick={onReset}>
            <RotateCcw className="size-3.5" />
            Reset demo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SignalField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
      <p className="text-muted-foreground text-xs">Comma-separated signals.</p>
    </div>
  );
}
