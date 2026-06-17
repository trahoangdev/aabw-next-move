# AABW Next Move

AABW Next Move is a live event copilot for Agentic AI Build Week builders.

It helps a builder answer one practical question during the event:

> What should I do next, right now?

The app turns a builder's project context, current day, current time, event schedule, venues, resources, mentors, and deadlines into a concrete recommendation: where to go, why it matters, what to do afterward, and what deadline or resource should not be missed.

## Why This Exists

Agentic AI Build Week runs across multiple days, venues, workshops, teammates, perks, deadlines, and demo milestones. Builders can easily miss the right session, arrive late to a venue, forget a submission task, or fail to connect with the mentor or resource that would unblock their project.

AABW Next Move is designed for that live-event pain point. It is not a generic chatbot. It is a workflow dashboard that gives builders structured next actions.

## Core Demo

The MVP lets you simulate different builder situations:

- Select a builder or team profile.
- Select the current AABW day.
- Select the current time.
- Get a ranked "Next Move" recommendation.
- See why the recommendation was made.
- Review the next action, follow-up action, and pre-demo checklist.
- Discover matching resources, perks, mentors, and deadlines.

Example recommendation:

> Attend "Ship your agent on a cloud stack" because it matches your deployment goal, fits your Vercel/Supabase stack, covers your deployment gap, and capacity is nearly full.

## Features

- Builder profile selector with project goals, stack, skill gaps, current venue, and priority.
- Real-time-style schedule navigator for AABW Day 1-5.
- Recommendation engine for workshops, mentor sessions, hackathon blocks, and demo milestones.
- Match confidence score with explanation.
- "Now / Next / Before demo" action plan.
- Venue context and travel notes.
- Resource and perk matching.
- Mentor matching.
- Deadline queue.
- Clean dashboard UI built on shadcn/ui components.
- Fully self-contained mock data. No internal AABW systems are required.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui-style component system
- Lucide icons
- Zustand for preferences inherited from the template shell
- Biome for formatting and linting

## Project Structure

```txt
src/
  app/
    (external)/
      page.tsx                         # Redirects / to /dashboard/next-move
    (main)/
      dashboard/
        page.tsx                       # Redirects /dashboard to /dashboard/next-move
        layout.tsx                     # Dashboard shell
        next-move/
          page.tsx                     # Main app route
          _components/
            data.ts                    # Mock AABW data
            next-move-dashboard.tsx    # Product dashboard and recommendation UI
  components/
    ui/                                # Reusable UI components kept from the template
  config/
    app-config.ts                      # App metadata
  navigation/
    sidebar/
      sidebar-items.ts                 # Single product nav entry
```

Only the AABW Next Move product route is kept. Template demo pages were removed, while the reusable UI component library remains available under `src/components/ui`.

## Mock Data

The MVP uses local mock data in:

```txt
src/app/(main)/dashboard/next-move/_components/data.ts
```

It includes:

- Event days: Enable, Integrate, Design, Build, Demo.
- Venues and travel notes.
- Workshops, mentor sessions, community events, hackathon blocks, and demo events.
- Builder profiles.
- Resources and perks.
- Mentors.
- Deadlines.

This keeps the project self-contained for judging and demo purposes. In a live deployment, this file can be replaced with data from Supabase, Airtable, Notion, a CMS, or an official AABW event API.

## Recommendation Logic

The current MVP uses deterministic scoring instead of a live LLM call.

Each event block is scored using:

- Goal overlap with the builder profile.
- Stack relevance.
- Skill gap relevance.
- Timing proximity.
- Venue match.
- Capacity urgency.

The explanation text is generated from the matched signals. This keeps the demo reliable and fast without requiring API keys.

Future AI upgrade path:

1. Store schedules, mentors, perks, and resources in Supabase.
2. Add embeddings with pgvector.
3. Retrieve relevant event data for the current builder context.
4. Use an LLM to produce concise explanations and action plans.
5. Keep deterministic rules for safety-critical constraints such as time, venue, and deadlines.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000/dashboard/next-move
```

If port `3000` is already in use, Next.js may start on another available port.

## Scripts

```bash
npm run dev       # Start local development server
npm run build     # Create production build
npm run start     # Start production server after build
npm run check     # Run Biome checks
npm run check:fix # Run Biome checks and apply safe fixes
npm run format    # Format files
```

## Verification

The current implementation has been verified with:

```bash
npm run check
npm run build
```

The production build route table should only include:

```txt
/
/_not-found
/dashboard
/dashboard/next-move
```

## Builder Experience Track Fit

AABW Next Move directly targets the Builder Experience Award brief:

- It solves a live event pain point.
- It helps builders act faster during the week.
- It reduces confusion around schedule, venue, resources, mentors, and deadlines.
- It is a working prototype, not a static concept.
- It uses AI-style recommendation and explanation logic meaningfully.
- It is self-contained and easy to run with mock data.
- It has a clear path to live deployment during AABW.

## What Is Not Included Yet

- Real authentication.
- Database persistence.
- Live AABW API integration.
- LLM API calls.
- Push notifications.
- Real map routing.

These are intentionally left out of the MVP to keep the prototype focused, reliable, and easy to judge.

## Suggested Next Steps

- Add a real onboarding form for builder/team profile creation.
- Persist selected profile and saved recommendations.
- Add Supabase tables for schedules, venues, resources, mentors, and deadlines.
- Add pgvector matching for resources and sessions.
- Add calendar export or reminder actions.
- Add a mobile-first event mode for use on-site.
