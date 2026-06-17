"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardCopy,
  Clock3,
  Compass,
  Flag,
  Gauge,
  Lightbulb,
  MapPin,
  Pencil,
  RotateCcw,
  Route,
  Save,
  Sparkles,
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

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
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

function activeDeadlines(deadlineList: typeof mockDeadlines, day: EventDay) {
  return deadlineList.filter((deadline) => deadline.day >= day).slice(0, 3);
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
  venueList,
}: {
  profile: BuilderProfile;
  dayMeta: (typeof eventDays)[number];
  selectedTime: string;
  best: EventBlock;
  next?: EventBlock;
  explanation: string;
  deadlineTitle?: string;
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
  ].join("\n");
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
  const [sessionId, setSessionId] = useState("");
  const [hasLoadedRemoteChecklist, setHasLoadedRemoteChecklist] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

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
  const actionItems = useMemo(
    () => [
      `move:${rec.best.id}`,
      rec.next ? `next:${rec.next.id}` : "next:notes",
      "before-demo",
      ...deadlineQueue.map((deadline) => `deadline:${deadline.id}`),
    ],
    [deadlineQueue, rec.best.id, rec.next],
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
    const text = actionPlanText({
      profile,
      dayMeta,
      selectedTime,
      best: rec.best,
      next: rec.next,
      explanation: aiInsight?.explanation ?? rec.explanation,
      deadlineTitle: deadlineQueue[0]?.title,
      venueList: eventData.venues,
    });

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Action plan copied");
    } catch {
      toast.error("Could not copy action plan");
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              Venue map
            </CardTitle>
            <CardDescription>OpenStreetMap venue context for the current and recommended move.</CardDescription>
          </CardHeader>
          <CardContent>
            <VenueMap
              venues={eventData.venues}
              currentVenueId={profile.currentVenue}
              recommendedVenueId={rec.best.venueId}
            />
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
                selected={block.id === rec.best.id}
                venues={eventData.venues}
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Why this helps builders</CardTitle>
          <CardDescription>Workflow output, not a plain chat response.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Cuts schedule confusion across multiple venues and days.",
            "Turns project context into concrete next actions.",
            "Persists profile and checklist state for real event use.",
            "Can run on public or mock data, then integrate with live AABW data.",
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
}: {
  venues: Venue[];
  currentVenueId: string;
  recommendedVenueId: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || venues.length === 0) return;

    let isActive = true;
    let map: import("leaflet").Map | undefined;

    void import("leaflet").then((L) => {
      if (!isActive || !containerRef.current) return;

      const center =
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

      for (const venue of venues) {
        const isCurrent = venue.id === currentVenueId;
        const isRecommended = venue.id === recommendedVenueId;
        const color = isRecommended
          ? "hsl(var(--primary))"
          : isCurrent
            ? "hsl(var(--chart-2))"
            : "hsl(var(--muted-foreground))";
        const label = isRecommended ? "Recommended" : isCurrent ? "Current" : "Venue";

        L.marker([venue.lat, venue.lng], {
          icon: L.divIcon({
            className: "",
            html: `<span style="display:block;width:18px;height:18px;border-radius:999px;background:${color};border:3px solid hsl(var(--background));box-shadow:0 6px 18px rgba(0,0,0,.24)"></span>`,
            iconAnchor: [9, 9],
            iconSize: [18, 18],
          }),
        })
          .addTo(map)
          .bindPopup(
            `<strong>${escapeHtml(venue.name)}</strong><br/><span>${escapeHtml(label)}</span><br/>${escapeHtml(
              venue.travelNote,
            )}`,
          );
      }

      window.setTimeout(() => map?.invalidateSize(), 0);
    });

    return () => {
      isActive = false;
      map?.remove();
    };
  }, [currentVenueId, recommendedVenueId, venues]);

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
  selected,
  rank,
  score,
  venues,
}: {
  block: EventBlock;
  selected: boolean;
  rank: number;
  score: number;
  venues: typeof mockVenues;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-background/60 p-3 transition-colors",
        selected && "border-primary/40 bg-primary/5",
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
          <span className="text-muted-foreground text-xs">{score}%</span>
        </div>
      </div>
      <p className="mt-2 text-muted-foreground text-sm">{block.outcome}</p>
    </div>
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
