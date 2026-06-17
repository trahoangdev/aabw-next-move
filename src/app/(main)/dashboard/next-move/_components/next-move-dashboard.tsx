"use client";

import { useMemo, useState } from "react";

import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Compass,
  Flag,
  Gauge,
  Lightbulb,
  MapPin,
  Route,
  Sparkles,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import {
  type BuilderProfile,
  deadlines,
  type EventBlock,
  type EventDay,
  eventDays,
  mentors,
  profiles,
  resources,
  schedule,
  venues,
} from "./data";

const demoTimes = ["09:00", "10:30", "14:00", "18:30", "21:30"];

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function overlapScore(a: string[], b: string[]) {
  const bSet = new Set(b);
  return a.reduce((score, item) => score + (bSet.has(item) ? 1 : 0), 0);
}

function venueName(id: string) {
  return venues.find((venue) => venue.id === id)?.name ?? id;
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

function getUpcomingBlocks(day: EventDay, selectedTime: string) {
  const now = toMinutes(selectedTime);
  return schedule
    .filter((block) => block.day === day && toMinutes(block.endTime) >= now - 15)
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}

function recommendation(profile: BuilderProfile, day: EventDay, selectedTime: string) {
  const upcoming = getUpcomingBlocks(day, selectedTime);
  const ranked = upcoming
    .map((block) => ({ block, score: scoreBlock(block, profile, selectedTime) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]?.block ?? schedule.find((block) => block.day === day) ?? schedule[0];
  const next = upcoming.find((block) => block.id !== best.id);

  return {
    best,
    next,
    score: Math.min(96, Math.max(58, ranked[0]?.score ?? 58)),
    explanation: explainMove(best, profile),
  };
}

function relevantResources(profile: BuilderProfile) {
  const signals = [...profile.goals, ...profile.stack, ...profile.skillGaps, profile.priority];
  return resources
    .map((resource) => ({
      resource,
      score: overlapScore(resource.tags, signals),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function relevantMentors(profile: BuilderProfile) {
  const signals = [...profile.goals, ...profile.stack, ...profile.skillGaps, profile.priority];
  return mentors
    .map((mentor) => ({ mentor, score: overlapScore(mentor.tags, signals) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function activeDeadlines(day: EventDay) {
  return deadlines.filter((deadline) => deadline.day >= day).slice(0, 3);
}

export function NextMoveDashboard() {
  const [profileId, setProfileId] = useState(profiles[0].id);
  const [selectedDay, setSelectedDay] = useState<EventDay>(2);
  const [selectedTime, setSelectedTime] = useState("10:30");

  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
  const dayMeta = eventDays.find((item) => item.day === selectedDay) ?? eventDays[0];
  const currentVenue = venues.find((venue) => venue.id === profile.currentVenue) ?? venues[0];

  const rec = useMemo(() => recommendation(profile, selectedDay, selectedTime), [profile, selectedDay, selectedTime]);
  const upcoming = useMemo(() => getUpcomingBlocks(selectedDay, selectedTime), [selectedDay, selectedTime]);
  const resourceMatches = useMemo(() => relevantResources(profile), [profile]);
  const mentorMatches = useMemo(() => relevantMentors(profile), [profile]);
  const deadlineQueue = useMemo(() => activeDeadlines(selectedDay), [selectedDay]);

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
              <Badge variant="secondary">MVP demo</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-background/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-muted-foreground text-xs">
                <Users className="size-3.5" />
                Builder profile
              </div>
              <div className="flex flex-wrap gap-2">
                {profiles.map((item) => (
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
        <MetricCard icon={Gauge} label="Match confidence" value={`${rec.score}%`} detail={rec.explanation} />
        <MetricCard icon={MapPin} label="Current venue" value={currentVenue.area} detail={currentVenue.travelNote} />
        <MetricCard
          icon={Flag}
          label="Open deadlines"
          value={String(deadlineQueue.length)}
          detail={deadlineQueue[0]?.title ?? "No upcoming event deadlines"}
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
            <CardAction>
              <Badge>{rec.best.type}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="rounded-xl border bg-background/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-muted-foreground text-sm">
                    {rec.best.time}-{rec.best.endTime} at {venueName(rec.best.venueId)}
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
                title="Now"
                icon={Route}
                detail={
                  rec.best.venueId === profile.currentVenue
                    ? "Stay on site and join the room before it fills."
                    : `Leave for ${venueName(rec.best.venueId)} and budget travel time.`
                }
              />
              <ActionStep
                title="Next"
                icon={Lightbulb}
                detail={rec.next ? `Afterward, consider ${rec.next.title}.` : "Capture notes and update your README."}
              />
              <ActionStep
                title="Before demo"
                icon={BadgeCheck}
                detail={deadlineQueue[0]?.detail ?? "Keep a fallback demo video and seeded data ready."}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Why this helps builders</CardTitle>
            <CardDescription>Workflow output, not a plain chat response.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Cuts schedule confusion across multiple venues and days.",
              "Turns project context into concrete next actions.",
              "Surfaces deadlines, mentors, and perks at the right moment.",
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Live schedule navigator</CardTitle>
            <CardDescription>Ranked for the selected day and time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.map((block) => (
              <ScheduleRow key={block.id} block={block} selected={block.id === rec.best.id} />
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
                  <div className="mt-2 text-muted-foreground text-xs">{venueName(mentor.venueId)}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {deadlineQueue.map((deadline) => (
                <div key={deadline.id} className="flex gap-3 rounded-lg border bg-muted/30 p-3">
                  <Flag
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      deadline.severity === "critical" ? "text-destructive" : "text-primary",
                    )}
                  />
                  <div>
                    <div className="font-medium text-sm">
                      Day {deadline.day}, {deadline.time}: {deadline.title}
                    </div>
                    <div className="text-muted-foreground text-xs">{deadline.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
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

function ActionStep({ title, detail, icon: Icon }: { title: string; detail: string; icon: typeof Route }) {
  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <div className="mb-2 flex items-center gap-2 font-medium text-sm">
        <Icon className="size-4 text-primary" />
        {title}
      </div>
      <p className="text-muted-foreground text-sm">{detail}</p>
    </div>
  );
}

function ScheduleRow({ block, selected }: { block: EventBlock; selected: boolean }) {
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
            {block.time}-{block.endTime} - {venueName(block.venueId)}
          </div>
          <div className="mt-1 font-medium">{block.title}</div>
        </div>
        <Badge variant={selected ? "default" : "outline"}>{selected ? "next" : block.type}</Badge>
      </div>
      <p className="mt-2 text-muted-foreground text-sm">{block.outcome}</p>
    </div>
  );
}
