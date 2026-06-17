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
- Create or edit a custom builder profile.
- Select the current AABW day.
- Select the current time.
- Get a ranked "Next Move" recommendation.
- See why the recommendation was made.
- Review the next action, follow-up action, and pre-demo checklist.
- Discover matching resources, perks, mentors, and deadlines.
- Mark actions and deadlines complete.
- Copy a plain-text action plan for Discord, WhatsApp, or team notes.

Example recommendation:

> Attend "Ship your agent on a cloud stack" because it matches your deployment goal, fits your Vercel/Supabase stack, covers your deployment gap, and capacity is nearly full.

## Features

- Builder profile selector with project goals, stack, skill gaps, current venue, and priority.
- Custom profile builder with local persistence.
- Real-time-style schedule navigator for AABW Day 1-5.
- Recommendation engine for workshops, mentor sessions, hackathon blocks, and demo milestones.
- Match confidence score with explanation.
- "Now / Next / Before demo" action plan.
- Copyable action plan.
- Persisted checklist and run readiness score.
- Daily runbook ranked by context, timing, venue, and urgency.
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
- Supabase JS + Supabase SSR
- OpenAI Node SDK with Responses API route
- Zustand for preferences inherited from the template shell
- Biome for formatting and linting

## Project Structure

```txt
src/
  app/
    api/
      ai/
        next-move/route.ts             # OpenAI Responses API with deterministic fallback
      event-data/route.ts              # Supabase event data loader with mock fallback
      profiles/route.ts                # Supabase builder profile upsert
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
  lib/
    aabw/supabase-mappers.ts           # Supabase row <-> app model mapping
    client.ts                          # Supabase browser client
    server.ts                          # Supabase server client
  navigation/
    sidebar/
      sidebar-items.ts                 # Single product nav entry
supabase/
  schema.sql                           # Tables, RLS policies, and seed data
```

Only the AABW Next Move product route is kept. Template demo pages were removed, while the reusable UI component library remains available under `src/components/ui`.

## Mock Data

The app can read from Supabase or fallback to local mock data.

Local mock data lives in:

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

This keeps the project self-contained for judging and demo purposes.

For Supabase-backed mode:

1. Open your Supabase project SQL editor.
2. Run:

```txt
supabase/schema.sql
```

3. Restart the dev server.
4. Open:

```txt
http://localhost:3000/api/event-data
```

When the schema is available, the API returns:

```json
{ "source": "supabase" }
```

If tables are not created yet, it returns:

```json
{ "source": "mock" }
```

The fallback is intentional so the demo keeps working before database setup.

The current browser session state is stored in `localStorage`:

- Custom builder profiles.
- Selected profile, event day, and time.
- Completed actions and deadlines.

This makes the prototype feel closer to an actual event tool without requiring a backend.

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

## OpenAI Setup

The app includes a server route:

```txt
POST /api/ai/next-move
```

It uses the OpenAI SDK when `OPENAI_API_KEY` is configured. Until then, it returns a deterministic fallback response, so the UI still works.

Add your key to `.env.local`:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4.1-mini
```

The API route is intentionally server-side only. The browser never receives the OpenAI API key.

## Supabase Setup

Dependencies are installed:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Supabase shadcn helper files are installed:

```txt
src/lib/client.ts
src/lib/server.ts
src/lib/middleware.ts
```

Environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://nwbssvcunlmuegqivqpq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_N9NqRpSLxY5-D8-6OWL2Kg_WECOIhUw
```

Tables included in `supabase/schema.sql`:

- `venues`
- `event_blocks`
- `resources`
- `mentors`
- `deadlines`
- `builder_profiles`
- `builder_checklist_items`

The current RLS policies are public-readable for event data and public insert/update for builder profiles/checklist items, which fits an unauthenticated event MVP. Tighten these policies when adding real auth.

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
- Supabase schema must be run before database persistence is active.
- Live official AABW API integration.
- OpenAI calls require `OPENAI_API_KEY`.
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
