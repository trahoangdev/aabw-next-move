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
  lat: number;
  lng: number;
}

export interface EventBlock {
  id: string;
  day: EventDay;
  time: string;
  endTime: string;
  title: string;
  host: string;
  venueId: string;
  type: "workshop" | "mentor" | "community" | "hackathon" | "demo" | "deadline" | "break";
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
    name: "Galaxy Innovation Park",
    area: "Saigon Hi-Tech Park",
    travelNote: "Main on-site venue for Build and Demo days. Plan cross-city travel if coming from District 1.",
    lat: 10.8522,
    lng: 106.7843,
  },
  {
    id: "cloud-hub",
    name: "AWS Office, Bitexco Tower",
    area: "District 1",
    travelNote: "Day 2 workshop venue at Bitexco Tower. Arrive early for reception and lift check-in.",
    lat: 10.7717,
    lng: 106.704,
  },
  {
    id: "model-lab",
    name: "VNG Campus",
    area: "District 7",
    travelNote: "Day 3 venue at VNG Campus, Tan Thuan. Budget extra travel time from District 1.",
    lat: 10.7415,
    lng: 106.7301,
  },
  {
    id: "community",
    name: "Tasco Office",
    area: "Ho Chi Minh City",
    travelNote: "Day 1 venue. Exact check-in details should be verified from Luma or registered-attendee emails.",
    lat: 10.7769,
    lng: 106.7009,
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
    id: "day1-registration",
    day: 1,
    time: "09:00",
    endTime: "10:00",
    title: "Registration and welcome",
    host: "AABW",
    venueId: "community",
    type: "community",
    tags: ["onboarding", "check-in", "orientation"],
    outcome: "Get checked in and orient around the first workshop day.",
    capacity: "open",
  },
  {
    id: "byteplus-creation-stack",
    day: 1,
    time: "10:00",
    endTime: "12:00",
    title: "Render the Next Era of Creation with BytePlus AI Stack",
    host: "BytePlus",
    venueId: "community",
    type: "workshop",
    tags: ["creation", "ai-stack", "media", "infrastructure"],
    outcome: "Understand how BytePlus tools can support AI creation workflows.",
    capacity: "limited",
  },
  {
    id: "nvidia-inception",
    day: 1,
    time: "14:00",
    endTime: "14:45",
    title: "Inside NVIDIA Inception Program: How Startups Build & Scale AI Globally",
    host: "NVIDIA",
    venueId: "community",
    type: "workshop",
    tags: ["startup", "scale", "nvidia", "infrastructure"],
    outcome: "Learn how AI startups use NVIDIA Inception to build and scale globally.",
    capacity: "nearly-full",
  },
  {
    id: "trae-workflow",
    day: 1,
    time: "15:00",
    endTime: "16:00",
    title: "TRAE in Your Professional Workflow",
    host: "TRAE",
    venueId: "community",
    type: "workshop",
    tags: ["developer-tools", "workflow", "productivity", "coding"],
    outcome: "Apply TRAE to professional build workflows and coding productivity.",
    capacity: "limited",
  },
  {
    id: "aws-morning-workshop",
    day: 2,
    time: "09:00",
    endTime: "10:30",
    title: "AWS workshop",
    host: "AWS",
    venueId: "cloud-hub",
    type: "workshop",
    tags: ["aws", "cloud", "deployment", "infrastructure"],
    outcome: "Work through AWS patterns for agentic AI infrastructure and deployment.",
    capacity: "limited",
  },
  {
    id: "agora-workshop",
    day: 2,
    time: "10:30",
    endTime: "12:00",
    title: "Agora workshop",
    host: "Agora",
    venueId: "cloud-hub",
    type: "workshop",
    tags: ["realtime", "voice", "video", "agents"],
    outcome: "Explore realtime audio/video infrastructure for interactive agent experiences.",
    capacity: "limited",
  },
  {
    id: "aws-afternoon-workshop",
    day: 2,
    time: "13:00",
    endTime: "14:30",
    title: "AWS workshop",
    host: "AWS",
    venueId: "cloud-hub",
    type: "workshop",
    tags: ["aws", "cloud", "enterprise", "deployment"],
    outcome: "Deepen cloud architecture patterns for enterprise-ready AI builds.",
    capacity: "limited",
  },
  {
    id: "tinyfish-workshop",
    day: 2,
    time: "14:30",
    endTime: "16:00",
    title: "Tiny Fish workshop",
    host: "Tiny Fish",
    venueId: "cloud-hub",
    type: "workshop",
    tags: ["automation", "agents", "workflow", "browser"],
    outcome: "Learn automation patterns for agent workflows and web tasks.",
    capacity: "limited",
  },
  {
    id: "aws-evening-workshop",
    day: 2,
    time: "16:30",
    endTime: "18:00",
    title: "AWS workshop",
    host: "AWS",
    venueId: "cloud-hub",
    type: "workshop",
    tags: ["aws", "cloud", "scaling", "deployment"],
    outcome: "Close the integration day with AWS deployment and scaling guidance.",
    capacity: "limited",
  },
  {
    id: "ai-gaming-night",
    day: 2,
    time: "18:00",
    endTime: "20:00",
    title: "AI x Gaming Night",
    host: "AABW",
    venueId: "cloud-hub",
    type: "community",
    tags: ["gaming", "community", "networking", "consumer-ai"],
    outcome: "Meet gaming and interactive AI builders after the integration workshops.",
    capacity: "open",
  },
  {
    id: "day3-registration",
    day: 3,
    time: "09:00",
    endTime: "10:00",
    title: "Registration and welcome",
    host: "AABW",
    venueId: "model-lab",
    type: "community",
    tags: ["onboarding", "check-in", "community"],
    outcome: "Check in at VNG Campus and prepare for the design day workshops.",
    capacity: "open",
  },
  {
    id: "apify-developer-economy",
    day: 3,
    time: "10:00",
    endTime: "12:00",
    title: "Build, Deploy & Monetize AI Agents: The Future of the Developer Economy",
    host: "Apify",
    venueId: "model-lab",
    type: "workshop",
    tags: ["agents", "deployment", "monetization", "developer-economy"],
    outcome: "Learn how to build, deploy, and monetize AI agents.",
    capacity: "limited",
  },
  {
    id: "langfuse-clickhouse",
    day: 3,
    time: "12:00",
    endTime: "14:00",
    title: "Langfuse x ClickHouse workshop",
    host: "Langfuse x ClickHouse",
    venueId: "model-lab",
    type: "workshop",
    tags: ["observability", "analytics", "evaluation", "data"],
    outcome: "Connect observability and analytics patterns to improve agent quality.",
    capacity: "limited",
  },
  {
    id: "gde-design-bottleneck",
    day: 3,
    time: "14:00",
    endTime: "15:00",
    title: "Beyond Autocomplete: How Agentic AI Solves the Enterprise Design Bottleneck",
    host: "Google Developer Experts",
    venueId: "model-lab",
    type: "workshop",
    tags: ["design", "enterprise", "agents", "google"],
    outcome: "Understand where agentic AI can remove enterprise design bottlenecks.",
    capacity: "limited",
  },
  {
    id: "tencent-cloud-workshop",
    day: 3,
    time: "15:00",
    endTime: "17:00",
    title: "Tencent Cloud workshop",
    host: "Tencent Cloud",
    venueId: "model-lab",
    type: "workshop",
    tags: ["cloud", "tencent", "deployment", "infrastructure"],
    outcome: "Explore Tencent Cloud infrastructure for AI products.",
    capacity: "limited",
  },
  {
    id: "builder-night",
    day: 3,
    time: "18:00",
    endTime: "20:00",
    title: "Builder Night",
    host: "AABW",
    venueId: "model-lab",
    type: "community",
    tags: ["community", "team-matching", "networking", "pitch"],
    outcome: "Meet collaborators and compare project directions before Build Day.",
    capacity: "open",
  },
  {
    id: "opening-keynotes",
    day: 4,
    time: "09:00",
    endTime: "12:00",
    title: "Opening Ceremony and Keynotes",
    host: "AABW",
    venueId: "main",
    type: "community",
    tags: ["keynotes", "onboarding", "build-day", "community"],
    outcome: "Align on the on-site build day and hear the final context before sprinting.",
    capacity: "open",
  },
  {
    id: "onsite-build-sprint",
    day: 4,
    time: "13:00",
    endTime: "16:00",
    title: "On-site Build Sprint",
    host: "AABW",
    venueId: "main",
    type: "hackathon",
    tags: ["build", "debug", "deployment", "submission"],
    outcome: "Focus on implementation, integration, and scope control for the final demo.",
    capacity: "limited",
  },
  {
    id: "expert-parade",
    day: 4,
    time: "16:00",
    endTime: "18:00",
    title: "Expert Parade",
    host: "AABW",
    venueId: "main",
    type: "mentor",
    tags: ["mentor", "feedback", "debug", "enterprise"],
    outcome: "Get targeted feedback from experts before the final late-night build push.",
    capacity: "limited",
  },
  {
    id: "networking-night-day4",
    day: 4,
    time: "18:00",
    endTime: "20:00",
    title: "Networking Night",
    host: "AABW",
    venueId: "main",
    type: "community",
    tags: ["networking", "community", "mentor", "enterprise"],
    outcome: "Meet partners, mentors, and other teams while refining your demo story.",
    capacity: "open",
  },
  {
    id: "late-night-build",
    day: 4,
    time: "20:00",
    endTime: "23:00",
    title: "Late Night Build",
    host: "AABW",
    venueId: "main",
    type: "hackathon",
    tags: ["build", "debug", "demo", "submission"],
    outcome: "Stabilize the project before the Demo Day submission deadline.",
    capacity: "open",
  },
  {
    id: "submission-deadline",
    day: 5,
    time: "09:00",
    endTime: "10:00",
    title: "Submission Deadline",
    host: "Devpost",
    venueId: "main",
    type: "deadline",
    tags: ["submission", "devpost", "deadline", "demo"],
    outcome: "Submit the final project before demo pitches begin.",
    capacity: "open",
  },
  {
    id: "demo-pitches",
    day: 5,
    time: "10:00",
    endTime: "12:00",
    title: "Demo Pitches",
    host: "AABW",
    venueId: "main",
    type: "demo",
    tags: ["demo", "pitch", "judging", "enterprise"],
    outcome: "Present your build to judges and enterprise partners.",
    capacity: "open",
  },
  {
    id: "awards-ceremony",
    day: 5,
    time: "16:00",
    endTime: "18:00",
    title: "Awards Ceremony",
    host: "AABW",
    venueId: "main",
    type: "demo",
    tags: ["awards", "judging", "community", "deployment"],
    outcome: "Close the week with winners, awards, and deployment conversations.",
    capacity: "open",
  },
  {
    id: "networking-night-day5",
    day: 5,
    time: "18:00",
    endTime: "20:00",
    title: "Networking Night",
    host: "AABW",
    venueId: "main",
    type: "community",
    tags: ["networking", "community", "enterprise", "pilot"],
    outcome: "Continue pilot and deployment conversations after awards.",
    capacity: "open",
  },
];

export const resources: Resource[] = [
  {
    id: "cloud-credit",
    title: "$1M+ ecosystem perks and credits",
    partner: "AABW Tech Partners",
    type: "credit",
    tags: ["credits", "infrastructure", "cloud", "tools"],
    action: "Registered builders get first access to partner credits, infrastructure, and tooling perks.",
  },
  {
    id: "eval-sheet",
    title: "Workshop RSVP links",
    partner: "Luma",
    type: "doc",
    tags: ["workshop", "rsvp", "luma", "schedule"],
    action: "Reserve individual workshop seats from the daily programme where RSVP links are available.",
  },
  {
    id: "submission-kit",
    title: "Devpost submission checklist",
    partner: "Devpost",
    type: "doc",
    tags: ["submission", "demo", "judging", "pitch"],
    action: "Confirm your track, add teammates, and submit the final project before the Demo Day deadline.",
  },
  {
    id: "community-intros",
    title: "Builder Experience brief",
    partner: "GenAI Fund",
    type: "perk",
    tags: ["builder-experience", "support", "deadline", "workflow"],
    action: "Use the brief to keep Builder Experience tools focused on live builder pain points.",
  },
];

export const mentors: Mentor[] = [
  {
    id: "aws-desk",
    name: "AWS Builder Desk",
    focus: "Cloud infrastructure, deployment, and enterprise-readiness",
    venueId: "cloud-hub",
    slot: "Day 2, 09:00-18:00",
    tags: ["aws", "deployment", "cloud", "enterprise"],
  },
  {
    id: "apify-desk",
    name: "Apify Developer Economy Desk",
    focus: "Building, deploying, and monetizing AI agents",
    venueId: "model-lab",
    slot: "Day 3, 10:00-12:00",
    tags: ["agents", "deployment", "monetization", "developer-economy"],
  },
  {
    id: "gde-desk",
    name: "Google Developer Experts",
    focus: "Enterprise design bottlenecks and agentic AI patterns",
    venueId: "model-lab",
    slot: "Day 3, 14:00-15:00",
    tags: ["design", "enterprise", "agents", "google"],
  },
  {
    id: "expert-parade",
    name: "Expert Parade",
    focus: "Final implementation feedback before Demo Day",
    venueId: "main",
    slot: "Day 4, 16:00",
    tags: ["mentor", "debug", "feedback", "demo"],
  },
];

export const deadlines: Deadline[] = [
  {
    id: "track-confirmation",
    day: 3,
    time: "21:00",
    title: "Track confirmation on Devpost",
    detail: "Confirm your track on Devpost before the July 10, 9:00 PM deadline.",
    severity: "high",
  },
  {
    id: "submit",
    day: 5,
    time: "09:00",
    title: "Submission deadline on Devpost",
    detail: "Submit live link, repo, project description, and demo assets before Demo Pitches.",
    severity: "critical",
  },
  {
    id: "demo-pitches",
    day: 5,
    time: "10:00",
    title: "Demo pitches begin",
    detail: "Be ready to present and answer judging or enterprise partner questions.",
    severity: "normal",
  },
];
