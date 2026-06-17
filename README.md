# AABW Next Move

Live builder-experience copilot for Agentic AI Build Week.

AABW Next Move helps builders answer one urgent event question:

> What should I do next, right now?

The app turns a builder profile, current event day/time, venue context, workshops, mentors, perks, teammate signals, deadlines, and retrieval context into a concrete action plan. It is designed for builders using it in the room during Agentic AI Build Week, not as a generic chatbot wrapper.

## Why It Exists

Agentic AI Build Week spans five days, multiple venues, partner workshops, teammate formation, support channels, perks, submission deadlines, judging, and Demo Day. Builders can easily miss the right session, arrive late to the next venue, forget a deadline, or fail to find the teammate or mentor who would unblock them.

AABW Next Move targets that live-event friction:

- Act faster with a ranked next move for the current day and time.
- Cut confusion across venues, workshops, mentors, perks, teammates, and deadlines.
- Convert AI output into workflow steps, checklists, calendar holds, and shareable team messages.
- Stay self-contained with mock/public event data, while supporting Supabase and OpenAI when configured.

## Demo Route

```txt
http://localhost:3000/dashboard/next-move
```

The root route and `/dashboard` redirect to the product route.

## Core Demo Flow

1. Pick or create a builder/team profile.
2. Select the current AABW day and time.
3. Review the ranked **Next Move** recommendation.
4. Use **Event Mode** for on-site movement risk, deadline guardrails, and support routing.
5. Inspect the venue map and ranked daily runbook.
6. Use **Live Triage** to clear venue, mentor, perk, deadline, team, and community-share blockers.
7. Use **Team Radar** to find collaborators who cover skill gaps and receive help back.
8. Copy an action plan, support request, team intro, progress update, or Devpost summary.
9. Download an `.ics` calendar hold for the recommended session.
10. Save plans and checklist progress for the current event session.

## Feature Set

- Builder profile selector and custom profile builder.
- Deterministic recommendation engine for workshops, mentoring, hackathon blocks, and Demo Day milestones.
- OpenAI-powered explanation route with deterministic fallback.
- Supabase pgvector retrieval over event documents with keyword fallback.
- Event Mode command panel for live venue movement and deadline risk.
- Leaflet + OpenStreetMap venue map.
- Daily runbook ranked by profile fit, timing, venue, and urgency.
- Resource/perk matching.
- Mentor matching.
- Team Radar for gap-aware collaborator matching with copyable ask/offer intro text.
- Live triage checklist.
- Saved action plan history.
- Supabase-backed checklist sync where available.
- Copyable action plan, support request, event brief, team intro, progress update, and Devpost summary.
- Downloadable calendar hold for the selected next move.
- Mock/public data fallback so judging and local demos work without private systems.

## Why This Fits The Builder Experience Award

The brief asks for an AI-powered tool, agent, workflow, or experience that improves the builder journey during AABW itself. AABW Next Move directly addresses that:

- It solves live event pain points: where to go, who to meet, what to protect before Demo Day, and how to ask for help.
- It is usable during the event on desktop or mobile.
- It is a working prototype with a real workflow surface.
- It uses AI meaningfully for explanations and retrieval, while deterministic rules guard time, venue, and deadline constraints.
- It is self-contained with mock data and can integrate with live AABW systems later.
- It avoids the disallowed "thin chatbot" pattern by producing concrete actions, checklists, maps, reminders, and shareable operational outputs.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui-style component library
- Lucide icons
- OpenAI Node SDK
- Supabase JS + Supabase SSR
- Supabase Postgres + pgvector RPC
- Leaflet + OpenStreetMap
- Biome
- Playwright
- Vercel config

## Project Structure

```txt
src/
  app/
    api/
      ai/next-move/route.ts             # OpenAI Responses API + deterministic fallback
      checklist/route.ts                # Checklist persistence
      embeddings/seed/route.ts          # Embeds event_documents
      event-data/route.ts               # Supabase loader + mock fallback
      profiles/route.ts                 # Builder profile upsert
      recommendations/route.ts          # Saved action plans
      retrieval/route.ts                # pgvector retrieval + keyword fallback
    (external)/page.tsx                 # Redirects / to product route
    (main)/dashboard/
      page.tsx                          # Redirects /dashboard to product route
      layout.tsx                        # Dashboard shell
      next-move/
        page.tsx                        # Main product page
        _components/
          data.ts                       # Mock AABW data
          next-move-dashboard.tsx       # Product workflow UI
  components/ui/                        # Reusable UI components
  config/app-config.ts                  # App metadata
  lib/
    aabw/supabase-mappers.ts            # Supabase row mapping
    client.ts                           # Supabase browser client
    server.ts                           # Supabase server client
  navigation/sidebar/sidebar-items.ts   # Product nav entry
supabase/schema.sql                     # Tables, RLS, pgvector RPC, seed data
tests/smoke.spec.ts                     # Playwright smoke test
vercel.json                            # Vercel build config
```

## Getting Started

Install dependencies:

```bash
npm install
```

Create local environment variables:

```bash
cp .env.example .env.local
```

Run the development server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000/dashboard/next-move
```

If port `3000` is in use, Next.js may start on another available port.

## Environment Variables

The app works without Supabase and OpenAI because it has deterministic and mock-data fallbacks. Configure these variables only when you want live persistence, pgvector retrieval, and OpenAI explanations.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

Keep `OPENAI_API_KEY` server-side only. Do not commit `.env.local`.

## Supabase Setup

Supabase is optional for local judging, but enables live event data, saved recommendations, checklist sync, custom profiles, and pgvector retrieval.

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run:

```txt
supabase/schema.sql
```

4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `.env.local`.
5. Restart the dev server.
6. Check:

```txt
http://localhost:3000/api/event-data
```

Expected response when Supabase is active:

```json
{ "source": "supabase" }
```

Expected response when Supabase is not configured:

```json
{ "source": "mock" }
```

## Seeding Semantic Retrieval

After running `supabase/schema.sql`, seed embeddings:

```bash
curl -X POST http://localhost:3000/api/embeddings/seed
```

Then test retrieval:

```bash
curl -X POST http://localhost:3000/api/retrieval \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"nextjs supabase deployment Day 2\", \"matchCount\":3}"
```

Expected source after embeddings exist:

```json
{ "source": "pgvector" }
```

Without embeddings or Supabase, the retrieval route falls back to keyword matching.

## AI And Recommendation Logic

The recommendation path is hybrid:

1. Deterministic scoring ranks schedule blocks by profile fit, timing, venue, and urgency.
2. `/api/retrieval` builds a query from builder context and event state.
3. Supabase pgvector returns semantic matches when embeddings exist.
4. `/api/ai/next-move` sends the recommendation and retrieval context to OpenAI.
5. If OpenAI, Supabase, or pgvector is unavailable, the UI still works with deterministic and keyword fallback logic.

Deterministic scoring considers:

- Builder goals.
- Stack relevance.
- Skill gaps.
- Current venue.
- Upcoming time window.
- Capacity urgency.
- Deadline proximity.
- Mentor, perk, and teammate fit.

## Scripts

```bash
npm run dev       # Start local development server
npm run build     # Production build
npm run start     # Start production server after build
npm run check     # Biome format/lint checks
npm run check:fix # Apply safe Biome fixes
npm run format    # Format files
npm run test:e2e  # Playwright smoke test
```

## Verification

Current verification commands:

```bash
npm run check
npm run build
npm run test:e2e
```

The production route table should include:

```txt
/
/_not-found
/api/ai/next-move
/api/checklist
/api/embeddings/seed
/api/event-data
/api/profiles
/api/recommendations
/api/retrieval
/dashboard
/dashboard/next-move
```

## Data Model

The mock and Supabase data model covers:

- Event days: Enable, Integrate, Design, Build, Demo.
- Venues and travel notes.
- Schedule blocks.
- Resources and perks.
- Mentors.
- Deadlines.
- Builder profiles.
- Checklist items.
- Saved recommendations.
- Event documents for semantic retrieval.

Local fallback data lives in:

```txt
src/app/(main)/dashboard/next-move/_components/data.ts
```

## Deployment

The project includes `vercel.json` and is ready for Vercel-style deployment.

For a minimal demo deploy:

1. Configure the same environment variables in the hosting provider.
2. Deploy the Next.js app.
3. Run `supabase/schema.sql` in Supabase if you want persistence and pgvector retrieval.
4. Run `/api/embeddings/seed` after deployment if semantic retrieval should use embeddings.

The app remains usable with mock data if Supabase or OpenAI are not configured.

## Current Limitations

These are intentionally left outside the MVP to keep the submission reliable and easy to judge:

- No real authentication yet.
- No official live AABW API integration yet.
- No push notifications yet.
- No turn-by-turn routing.
- No automatic Discord or WhatsApp bot posting; current outputs are copyable.
- pgvector retrieval requires running the Supabase schema and embedding seed route.
- OpenAI explanations require `OPENAI_API_KEY`.

## Next Steps

- Add Supabase Auth and per-team ownership.
- Add official AABW schedule/venue/feed integration.
- Add live seat capacity and RSVP status.
- Add push reminders for urgent venue moves and submission deadlines.
- Add Discord or WhatsApp bot delivery for support requests and team intros.
- Add turn-by-turn venue routing.

## Security Note

Do not commit real API keys. If an OpenAI key has been exposed in chat, screenshots, logs, or git history, revoke it and create a new key before deploying or sharing the repository.
