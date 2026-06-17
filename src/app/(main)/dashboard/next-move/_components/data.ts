export type EventDay = 1 | 2 | 3 | 4 | 5;

export interface BuilderProfile {
  id: string;
  name: string;
  project: string;
  track: string;
  goals: string[];
  stack: string[];
  skillGaps: string[];
  currentVenue: string;
  priority: "learn" | "debug" | "find-team" | "prepare-demo";
}

export interface Venue {
  id: string;
  name: string;
  area: string;
  travelNote: string;
}

export interface EventBlock {
  id: string;
  day: EventDay;
  time: string;
  endTime: string;
  title: string;
  host: string;
  venueId: string;
  type: "workshop" | "mentor" | "community" | "hackathon" | "demo" | "deadline";
  tags: string[];
  outcome: string;
  capacity: "open" | "limited" | "nearly-full";
}

export interface Resource {
  id: string;
  title: string;
  partner: string;
  type: "perk" | "doc" | "template" | "credit";
  tags: string[];
  action: string;
}

export interface Mentor {
  id: string;
  name: string;
  focus: string;
  venueId: string;
  slot: string;
  tags: string[];
}

export interface Deadline {
  id: string;
  day: EventDay;
  time: string;
  title: string;
  detail: string;
  severity: "normal" | "high" | "critical";
}

export const eventDays = [
  { day: 1 as const, label: "Day 1", theme: "Enable", date: "Jul 8" },
  { day: 2 as const, label: "Day 2", theme: "Integrate", date: "Jul 9" },
  { day: 3 as const, label: "Day 3", theme: "Design", date: "Jul 10" },
  { day: 4 as const, label: "Day 4", theme: "Build", date: "Jul 11" },
  { day: 5 as const, label: "Day 5", theme: "Demo", date: "Jul 12" },
];

export const venues: Venue[] = [
  {
    id: "main",
    name: "AABW Main Venue",
    area: "District 1",
    travelNote: "Central hackathon floor. Keep 10 minutes for badge and lift queues.",
  },
  {
    id: "cloud-hub",
    name: "Cloud Partner Hub",
    area: "District 1",
    travelNote: "12 minutes from main venue by ride hailing in normal traffic.",
  },
  {
    id: "model-lab",
    name: "Model Lab",
    area: "Thu Thiem",
    travelNote: "Plan 25 minutes from District 1; bridge traffic spikes after 17:00.",
  },
  {
    id: "community",
    name: "Community Night Space",
    area: "District 3",
    travelNote: "Best for team matching, mentor intros, and informal project feedback.",
  },
];

export const profiles: BuilderProfile[] = [
  {
    id: "agentops",
    name: "AgentOps team",
    project: "Multi-agent support copilot for event help desk triage",
    track: "Builder Experience",
    goals: ["support", "routing", "deployment", "evaluation"],
    stack: ["nextjs", "openai", "supabase", "vercel"],
    skillGaps: ["deployment", "evaluation"],
    currentVenue: "main",
    priority: "debug",
  },
  {
    id: "matchlab",
    name: "MatchLab solo builder",
    project: "Team matching tool for founders, designers, and AI engineers",
    track: "Builder Experience",
    goals: ["team-matching", "community", "onboarding", "pitch"],
    stack: ["nextjs", "postgres", "embeddings"],
    skillGaps: ["frontend", "growth"],
    currentVenue: "community",
    priority: "find-team",
  },
  {
    id: "demoready",
    name: "DemoReady duo",
    project: "Deadline and judging checklist for hackathon teams",
    track: "Builder Experience",
    goals: ["demo", "submission", "judging", "workflow"],
    stack: ["react", "openai", "analytics"],
    skillGaps: ["storytelling", "metrics"],
    currentVenue: "main",
    priority: "prepare-demo",
  },
];

export const schedule: EventBlock[] = [
  {
    id: "kickoff",
    day: 1,
    time: "09:00",
    endTime: "10:15",
    title: "Registration, welcome, and buildathon kickoff",
    host: "AABW",
    venueId: "main",
    type: "workshop",
    tags: ["onboarding", "rules", "submission"],
    outcome: "Leave with the event map, Discord channels, and judging expectations.",
    capacity: "open",
  },
  {
    id: "ai-stack-primer",
    day: 1,
    time: "11:00",
    endTime: "12:00",
    title: "Agent stack primer",
    host: "Model Partner",
    venueId: "model-lab",
    type: "workshop",
    tags: ["openai", "agents", "evaluation", "workflow"],
    outcome: "Pick a practical agent architecture and know what to avoid.",
    capacity: "limited",
  },
  {
    id: "cloud-deploy",
    day: 2,
    time: "10:30",
    endTime: "11:45",
    title: "Ship your agent on a cloud stack",
    host: "Cloud Partner",
    venueId: "cloud-hub",
    type: "workshop",
    tags: ["deployment", "vercel", "cloud", "supabase", "postgres"],
    outcome: "Get a deploy path, env checklist, and starter infra pattern.",
    capacity: "nearly-full",
  },
  {
    id: "rag-evals",
    day: 2,
    time: "14:00",
    endTime: "15:30",
    title: "RAG and evaluation clinic",
    host: "AI Partner",
    venueId: "model-lab",
    type: "workshop",
    tags: ["evaluation", "embeddings", "retrieval", "quality"],
    outcome: "Improve retrieval quality and define demoable success metrics.",
    capacity: "limited",
  },
  {
    id: "ux-review",
    day: 3,
    time: "10:00",
    endTime: "11:00",
    title: "Builder UX review circle",
    host: "Community mentors",
    venueId: "community",
    type: "mentor",
    tags: ["frontend", "onboarding", "community", "workflow"],
    outcome: "Get fast feedback on the first minute of your product.",
    capacity: "open",
  },
  {
    id: "community-night",
    day: 3,
    time: "18:30",
    endTime: "21:00",
    title: "Community night and team introductions",
    host: "AABW",
    venueId: "community",
    type: "community",
    tags: ["team-matching", "pitch", "community", "growth"],
    outcome: "Meet missing teammates, mentors, and early users.",
    capacity: "open",
  },
  {
    id: "hackathon-floor",
    day: 4,
    time: "09:30",
    endTime: "18:00",
    title: "Heads-down hackathon build block",
    host: "AABW",
    venueId: "main",
    type: "hackathon",
    tags: ["debug", "deployment", "workflow", "submission"],
    outcome: "Stabilize the live demo, collect feedback, and cut scope.",
    capacity: "open",
  },
  {
    id: "demo-coaching",
    day: 4,
    time: "19:00",
    endTime: "20:30",
    title: "Demo story and judging clinic",
    host: "Judging mentors",
    venueId: "main",
    type: "mentor",
    tags: ["demo", "judging", "storytelling", "metrics", "pitch"],
    outcome: "Turn your prototype into a clear 2-minute narrative.",
    capacity: "limited",
  },
  {
    id: "demo-day",
    day: 5,
    time: "09:00",
    endTime: "12:00",
    title: "Demo Day check-in and rehearsal",
    host: "AABW",
    venueId: "main",
    type: "demo",
    tags: ["demo", "submission", "judging", "pitch"],
    outcome: "Confirm final build, backup assets, and presenter flow.",
    capacity: "open",
  },
  {
    id: "awards",
    day: 5,
    time: "16:00",
    endTime: "18:00",
    title: "Final demos, judging, and awards",
    host: "AABW",
    venueId: "main",
    type: "demo",
    tags: ["demo", "judging", "community"],
    outcome: "Present, get scored, and close the week with the builder community.",
    capacity: "open",
  },
];

export const resources: Resource[] = [
  {
    id: "cloud-credit",
    title: "Cloud launch credits",
    partner: "Cloud Partner",
    type: "credit",
    tags: ["deployment", "cloud", "vercel", "postgres"],
    action: "Claim before opening a production database or long-running job.",
  },
  {
    id: "eval-sheet",
    title: "Agent evaluation scorecard",
    partner: "AI Partner",
    type: "template",
    tags: ["evaluation", "quality", "judging", "metrics"],
    action: "Use it to prove the agent works beyond a happy-path demo.",
  },
  {
    id: "submission-kit",
    title: "Devpost submission checklist",
    partner: "AABW",
    type: "doc",
    tags: ["submission", "demo", "judging", "pitch"],
    action: "Attach live link, repo, short description, and a 2-minute demo video.",
  },
  {
    id: "community-intros",
    title: "Team intro board",
    partner: "Discord",
    type: "perk",
    tags: ["team-matching", "community", "growth", "onboarding"],
    action: "Post your missing role and the next 4-hour milestone.",
  },
];

export const mentors: Mentor[] = [
  {
    id: "mai",
    name: "Mai Tran",
    focus: "Agent evaluation and retrieval quality",
    venueId: "model-lab",
    slot: "Day 2, 15:45",
    tags: ["evaluation", "retrieval", "openai", "metrics"],
  },
  {
    id: "khoa",
    name: "Khoa Nguyen",
    focus: "Deployment, infra, and launch readiness",
    venueId: "cloud-hub",
    slot: "Day 2, 12:15",
    tags: ["deployment", "cloud", "supabase", "vercel"],
  },
  {
    id: "linh",
    name: "Linh Pham",
    focus: "Demo story, pitch, and judging clarity",
    venueId: "main",
    slot: "Day 4, 20:45",
    tags: ["demo", "pitch", "judging", "storytelling"],
  },
  {
    id: "an",
    name: "An Vo",
    focus: "Community loops and team matching",
    venueId: "community",
    slot: "Day 3, 19:30",
    tags: ["team-matching", "community", "growth", "onboarding"],
  },
];

export const deadlines: Deadline[] = [
  {
    id: "repo-ready",
    day: 4,
    time: "16:00",
    title: "Repo and README freeze",
    detail: "Make the project runnable from a clean checkout with seeded mock data.",
    severity: "high",
  },
  {
    id: "video-cut",
    day: 4,
    time: "22:00",
    title: "Demo video backup",
    detail: "Record a short fallback video in case Wi-Fi or APIs fail on Demo Day.",
    severity: "normal",
  },
  {
    id: "submit",
    day: 5,
    time: "10:30",
    title: "Final submission check",
    detail: "Confirm live link, repo, description, track fit, and judging story.",
    severity: "critical",
  },
];
