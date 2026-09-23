SaferPath

Choose your route with more context.

A time-aware, privacy-conscious urban mobility companion that helps travellers compare route alternatives using contextual evidence, understand uncertainty, discover nearby assistance, and optionally stay connected during an active journey.

Team: Team Ignited
Challenge: CX1002 — The Route Nobody Warned Her About
Pilot Focus: Mumbai urban walking corridors

Table of Contents

Overview

The Problem

What SaferPath Does

Core MVP Features

Product Flow

Architecture

Technology Stack

Repository Structure

Getting Started

Environment Configuration

Running the Application

Docker-Optional Development

Manual MVP Demo Flow

API Overview

Privacy & Safety Principles

Testing & Quality Checks

Known Limitations

Future Roadmap

Project Status

Contributing

License

Overview

SaferPath is a civic-tech mobility platform designed around a simple idea:

navigation tells you how to get there; SaferPath helps you understand the context around the routes you could take.

For an urban journey, the most relevant route can depend on more than travel time. Lighting, pedestrian infrastructure, activity context, transit presence, nearby assistance, reporting freshness, and data coverage can change with the time of travel.

SaferPath therefore presents multiple route alternatives with contextual evidence, rather than reducing the journey to a single opaque score.

The traveller remains in control.

SaferPath recommends. You decide.

The Problem

Conventional route planning is excellent at answering questions such as:

How long will this journey take?

Which route is shortest?

Which route has fewer transfers?

But a traveller may also need to understand:

Will the route be evaluated during daylight or after dark?

Is street-lighting evidence available along the route?

What is known about pedestrian infrastructure?

Is activity context sparse or well mapped?

Are verified assistance facilities nearby?

How fresh and complete is the available evidence?

Which parts of the route are better observed than others?

These factors can change over time, while a route can remain geographically identical.

SaferPath adds a time-aware context layer to route planning and optional active-trip support.

What SaferPath Does

1. Understand the journey

Users can enter ordinary place names instead of coordinates.

Examples:

Shivaji Park

Dadar Station

Worli

College

Office

saved routine locations

Place search resolves the selected location to coordinates internally.

2. Compare route alternatives

The route engine returns multiple real walking alternatives when the selected routing provider supports them.

Each alternative can expose:

duration

distance

walking context

contextual band

supporting evidence

uncertainty

data freshness

confidence

The user can switch between alternatives and inspect the corresponding route on the map.

3. Apply the Time Lens

The same corridor can be evaluated for different departure or arrival times.

SaferPath can surface changes in:

daylight

mapped lighting

activity context

transit context

operating hours

help-point availability

evidence freshness

4. Explain the route

Instead of a hidden numerical score, the application explains:

What supports this route

mapped lighting

pedestrian infrastructure

active frontage

transit context

verified help points

What is uncertain

sparse mapped activity

missing infrastructure data

stale evidence

unknown operating status

5. Discover nearby assistance

Help Nearby can surface supported public facilities such as:

police

hospitals

clinics

pharmacies

staffed transit points

security/help desks

verified partner facilities

Users can inspect details such as:

facility name

category

distance

verification status

operating hours when known

contact/navigation actions

6. Start an optional active trip

Active-trip tracking is separate from route planning.

After explicit consent, the app can:

track the current journey using browser GPS

display current position

maintain a live breadcrumb

provide trip status

support check-ins

detect meaningful route deviation

reconnect through SSE or polling fallback

conclude the journey when the destination is reached under the implemented rules

7. Smart Deviation

When a meaningful deviation occurs, SaferPath does not automatically assume an emergency.

The flow asks the traveller whether the route change was intentional.

Intentional: evaluate the changed route and update context.

Not intentional: initiate the configured trusted-contact escalation flow.

8. Trusted contacts

Users can add multiple trusted contacts and provide:

display name

email/reference

phone number

relationship

Development mode also supports terminal-only verification codes for demonstration and testing.

9. Reports

Users can submit structured observations such as:

poor lighting

accessibility issue

pedestrian infrastructure

activity context

transit context

custom observation (Something else)

Reports can include optional evidence and are handled as structured evidence rather than instant public truth.

10. Emergency handoff

SaferPath provides an explicit emergency handoff pathway.

The product distinguishes between:

displaying an emergency action

opening/calling an official pathway

recording the handoff state

confirmed external response

SaferPath does not claim emergency dispatch or guaranteed rescue unless an actual external integration confirms it.

11. Privacy controls

The product separates:

route planning
from
active-trip location sharing

Location access is not silently enabled simply because the user opens the application.

Users can also manage profile preferences, consent records, trusted-contact sharing, and privacy controls.

Core MVP Features

Capability

MVP

Passwordless OTP authentication

✅

Progressive onboarding

✅

Traveller type/profile

✅

Trusted contacts

✅

Trusted contact phone number

✅

Saved recurring routines

✅

Real place-name search

✅

Current-location selection

✅

Walking route comparison

✅

Multiple route alternatives

✅

Time-aware context

✅

Route evidence breakdown

✅

Segment-level context

✅

Interactive MapTiler + MapLibre map

✅

Origin/destination markers

✅

Help-point map markers

✅

Help-point details

✅

Active-trip tracking

✅

Browser GPS breadcrumb

✅

SSE + polling fallback

✅

Smart deviation flow

✅

Trusted-contact escalation

✅

Structured reports

✅

Custom report text

✅

Optional evidence upload

✅

Emergency handoff

✅

Privacy controls

✅

Dark mode

✅

Responsive/mobile UI

✅

Landing-page motion/visualization

✅

Product Flow

                    ┌────────────────────┐
                    │   SaferPath Web    │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Login / Verify OTP │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │    Onboarding      │
                    │ Profile / Routine  │
                    │ Trusted Contacts   │
                    │ Privacy / Consent  │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │      Home          │
                    │ Origin + Dest.     │
                    │ Place Search       │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Route Comparison   │
                    │ 2–3 alternatives   │
                    │ Time-aware context │
                    └─────────┬──────────┘
                              │
             ┌────────────────┼────────────────┐
             │                │                │
      ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
      │ Why Route?  │ │ Help Nearby │ │ Start Trip  │
      │ Evidence    │ │ Facilities  │ │ GPS + SSE   │
      └─────────────┘ └─────────────┘ └──────┬──────┘
                                             │
                                  ┌──────────▼──────────┐
                                  │ Smart Deviation     │
                                  │ Intentional?        │
                                  └──────────┬──────────┘
                                             │
                            ┌────────────────┴────────────────┐
                            │                                 │
                     Intentional                       Not intentional
                            │                                 │
                     Re-evaluate route                Trusted-contact
                     and context                       escalation

Architecture

SaferPath is split into a canonical React frontend and a FastAPI/PostgreSQL backend.

┌─────────────────────────────────────────────────────────────────┐
│ React / Vite PWA │
│ │
│ Landing • Auth • Onboarding • Home • Routes • Trips • Reports │
│ Help Nearby • Profile • Privacy • Emergency │
└───────────────────────────────┬─────────────────────────────────┘
│ HTTP / SSE
▼
┌─────────────────────────────────────────────────────────────────┐
│ FastAPI Backend │
│ │
│ Identity Routing Context Reports Help Points Trips │
│ Trusted Contacts Sharing Emergency Privacy │
└───────────────┬─────────────────────────────────┬───────────────┘
│ │
▼ ▼
┌──────────────────┐ ┌────────────────────────┐
│ PostgreSQL │ │ External data/services │
│ + PostGIS │ │ │
│ │ │ • Valhalla / routing │
│ Users │ │ • MapTiler / maps │
│ Routes │ │ • Open-Meteo / weather │
│ Context │ │ • OSM / Overpass │
│ Reports │ │ │
│ Trips │ └────────────────────────┘
│ Help Points │
└──────────────────┘

Frontend map architecture

SaferPath uses MapTiler + MapLibre.

MapTiler provides hosted map styles, tiles, and geocoding capabilities used by the application.

MapLibre GL JS remains the browser rendering engine.

SaferPath owns its route GeoJSON, route selection layers, origin/destination markers, help-point markers, GPS marker, breadcrumb and map interactions.

This separation allows the mapping provider to evolve without replacing the application's route/context domain.

Technology Stack

Frontend

React 19

TypeScript

Vite

Tailwind CSS

Framer Motion

Lucide React

React Router

MapLibre GL JS

MapTiler

Browser Geolocation API

Server-Sent Events (SSE)

Backend

Python 3.12+

FastAPI

Uvicorn

Pydantic

SQLAlchemy

Alembic

PostgreSQL

PostGIS

Psycopg

Structlog

SlowAPI

Routing & Context

Provider-independent routing boundary

Valhalla walking route support in the current development configuration

OSRM configuration retained for provider compatibility/testing

OpenStreetMap/Overpass-derived infrastructure context

Open-Meteo weather context

deterministic contextual evaluation and freshness handling

Engineering & QA

Pytest

Ruff

TypeScript compiler

ESLint

Vite production build

Repository Structure

saferpath/
├── backend/
│ ├── app/
│ │ ├── api/
│ │ ├── core/
│ │ ├── models/
│ │ ├── modules/
│ │ │ ├── context/
│ │ │ ├── identity/
│ │ │ ├── routing/
│ │ │ └── trips/
│ │ └── main.py
│ ├── migrations/
│ ├── scripts/
│ ├── tests/
│ ├── .env.example
│ ├── docker-compose.yml
│ ├── pyproject.toml
│ └── README.md
│
├── frontend/
│ ├── src/
│ │ ├── api/
│ │ ├── components/
│ │ │ ├── app/
│ │ │ ├── brand/
│ │ │ ├── landing/
│ │ │ ├── map/
│ │ │ └── product/
│ │ ├── context/
│ │ ├── pages/
│ │ └── utils/
│ ├── .env.example
│ ├── package.json
│ └── vite.config.ts
│
├── doc/
├── docs/
├── README.md
└── .gitignore

Getting Started

Prerequisites

Recommended local environment:

Node.js 20+

npm

Python 3.12–3.14

PostgreSQL with PostGIS

Git

Docker is optional for local database provisioning.

You also need:

a MapTiler API key for map styling/geocoding

a PostgreSQL/PostGIS connection string

Environment Configuration

Frontend

Create:

frontend/.env

Example:

VITE_API_URL=http://127.0.0.1:8000/v1
VITE_MAPTILER_API_KEY=YOUR_MAPTILER_BROWSER_KEY
VITE_MAP_STYLE_URL=

Do not commit frontend/.env.

For local browser applications, configure the MapTiler browser key with allowed HTTP origins such as your local development origins.

Backend

Create:

backend/.env

A minimal development configuration:

APP_NAME=SaferPath API
APP_ENV=development
DEBUG=true
API_V1_PREFIX=/v1

DATABASE_URL=postgresql+psycopg://saferpath:saferpath@localhost:5435/saferpath

CORS_ORIGINS=http://localhost:5173
TRUSTED_HOSTS=localhost,127.0.0.1

DEMO_MODE=true

ROUTING_PROVIDER=valhalla
ROUTING_VALHALLA_URL=https://valhalla1.openstreetmap.de/route

ROUTING_OSRM_URL=https://router.project-osrm.org
ROUTING_OSRM_PROFILE=foot

WEATHER_PROVIDER=fixture
OPEN_METEO_BASE_URL=https://api.open-meteo.com

AUTH_SECRET=change-me-in-development

The complete templates are available at:

backend/.env.example
frontend/.env.example

Secrets

Never commit:

real MapTiler API keys

database passwords

authentication secrets

analytics secrets

admin tokens

provider credentials

Use environment variables or a deployment secret manager.

Running the Application

1. Backend

From the repository root:

cd backend

py -m venv .venv

.\.venv\Scripts\Activate.ps1

python -m pip install -e ".[dev]"

Copy-Item .env.example .env

Edit .env and set the actual database connection.

Run migrations:

python -m alembic upgrade head

Start FastAPI:

python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

Backend:

http://127.0.0.1:8000

Health:

http://127.0.0.1:8000/v1/health

OpenAPI:

http://127.0.0.1:8000/docs

2. Frontend

Open a second terminal:

cd frontend
npm ci
npm run dev

Frontend:

http://localhost:5173

Docker-Optional Development

Docker is useful for quickly provisioning PostgreSQL/PostGIS, but it is not required to run the application code.

Start the database with:

docker compose -f backend\docker-compose.yml up -d

Check:

docker compose -f backend\docker-compose.yml ps

The Compose database is exposed locally on:

localhost:5435

Then run the FastAPI application directly on the host:

cd backend
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

This means:

Docker
└── PostgreSQL + PostGIS only

Windows host
├── FastAPI
└── React/Vite

Manual MVP Demo Flow

For a hackathon demonstration, use one consistent Mumbai walking scenario.

Recommended scenario

Origin: Shivaji Park
Destination: Dadar Station
Traveller: Student
Journey: Evening walk

Suggested demo order

Landing page

Show the SaferPath brand and animated route visualization.

Introduce the problem in one or two sentences.

Passwordless login

Request OTP.

Use the development terminal OTP.

Verify and enter the MVP.

Onboarding

Show traveller type.

Add a trusted contact.

Configure a recurring routine.

Show privacy/location consent.

Route planning

Search Shivaji Park.

Search Dadar Station.

Select the evening journey.

Compare routes.

Route comparison

Show 2–3 alternatives.

Highlight the selected route.

Point to walking duration and distance.

Show context labels.

Why this route

Show supporting evidence.

Show uncertainty/freshness.

Inspect a route segment.

Help Nearby

Show real help-point markers.

Open one marker and inspect its details.

Active trip

Start the selected route.

Show explicit live-location consent.

Move to the Trips workspace.

Show active status and GPS/trip state.

Smart deviation

Run the development demonstration flow.

Show the intentional/non-intentional decision.

Show route re-evaluation or trusted-contact escalation.

Reports

Submit a structured observation.

Show the Something else option and optional evidence.

Emergency boundary

Open the emergency flow.

Show confirmation/handoff behavior without actually calling emergency services during a recording.

Closing

Summarize the product thesis:
Context. Consent. Choice.

API Overview

Identity

POST /v1/auth/codes
POST /v1/auth/verify
GET /v1/profile
PATCH /v1/profile
GET /v1/consents
POST /v1/consents

Routes

POST /v1/routes/compare
GET /v1/routes/{route_id}
GET /v1/routes/{route_id}/context

Reports

POST /v1/reports
GET /v1/reports
GET /v1/reports/{report_id}
POST /v1/reports/{report_id}/evidence/authorize
POST /v1/reports/{report_id}/evidence/complete

Help Points

GET /v1/help-points/nearby

Trips

POST /v1/trips
GET /v1/trips/{trip_id}
GET /v1/trips/{trip_id}/stream
POST /v1/trips/{trip_id}/events
POST /v1/trips/{trip_id}/check-in
POST /v1/trips/{trip_id}/stop
POST /v1/trips/{trip_id}/deviation-response
POST /v1/trips/{trip_id}/demo-deviation

Trusted Contacts & Sharing

GET /v1/trusted-contacts
POST /v1/trusted-contacts
POST /v1/trusted-contacts/{contact_id}/verification-code
POST /v1/trusted-contacts/{contact_id}/verify
POST /v1/trusted-contacts/{contact_id}/revoke

POST /v1/sharing-grants
POST /v1/sharing-grants/{grant_id}/revoke

Emergency

POST /v1/emergency/handoff
POST /v1/emergency/handoff/{handoff_id}/action

Privacy & Safety Principles

SaferPath is intentionally designed to avoid false certainty.

Evidence, not guarantees

The product uses contextual terms such as:

Stronger contextual support

Good context

Mixed context

Caution segment

Limited data

Unknown context

It does not present an opaque numerical "safety score" or claim that a street is guaranteed safe or unsafe.

Planning is not tracking

Searching for a route does not automatically begin continuous location collection.

Active-trip tracking requires a distinct user consent decision.

Minimal data

Profile data is purpose-driven and optional where possible.

Controlled sharing

Trusted-contact sharing is:

user-selected

scoped

purpose-specific

revocable

time-limited where applicable

Coarse community reporting

Reports use coarse context and moderation boundaries rather than broadcasting precise private locations.

Emergency truthfulness

The application clearly separates:

guidance

display

call/deep-link handoff

approved external integration

actual confirmation

The system never fabricates successful emergency dispatch.

Testing & Quality Checks

Frontend

cd frontend

npx tsc -b
npm run lint
npm run build

Backend

cd backend

python -m pytest -q
ruff check .

Database

python -m alembic current
python -m alembic heads
python -m alembic upgrade head

Recommended browser smoke test

Login
→ OTP
→ Onboarding
→ Place Search
→ Route Compare
→ Select Route
→ Why Route
→ Help Nearby
→ Start Trip
→ GPS / SSE
→ Deviation
→ Reports
→ Emergency boundary
→ Profile / Privacy

Known Limitations

SaferPath is currently an MVP/pilot-oriented implementation.

Routing infrastructure

The current development configuration uses a provider-backed walking routing service. Public routing endpoints are suitable for development/demo validation but should be replaced with a managed or self-hosted production-grade routing deployment for predictable performance and scale.

Context coverage

Context quality depends on the availability, freshness and spatial coverage of the underlying data sources.

Missing data is represented as uncertainty rather than inferred as negative evidence.

Emergency response

The application provides an explicit emergency handoff boundary. It does not operate a dispatch centre and cannot claim a successful external emergency response without a real integration.

Evidence storage

The local/development evidence path is an integration boundary. Production deployments should use durable object storage and a production malware/content scanning pipeline.

Notifications

Development environments may expose terminal-only notification/OTP output for demonstration and testing. Production notification delivery requires a real provider integration.

Future Roadmap

Phase 1 — Bounded pilot

Improve field-verified help-point coverage

Expand pedestrian routing coverage

Improve corridor evidence quality

Harden accessibility and multilingual UX

Increase observability and operational monitoring

Phase 2 — Institutional partnerships

Potential integrations with:

colleges and campuses

employers

mobility operators

civic organizations

verified local assistance networks

Potential capabilities:

institution-managed context corridors

organization dashboards

aggregated route-context analytics

managed emergency workflows

Phase 3 — Platform expansion

additional cities

improved walking/mixed-mode routing

richer temporal context

stronger accessibility-aware route planning

deeper provider integrations

partner APIs

richer traveler routines and preferences

The core product principle remains unchanged:

Make contextual evidence visible while keeping the traveller in control.

Project Status

Current MVP

Authentication ✅
Progressive onboarding ✅
Trusted contacts ✅
Recurring routines ✅
Place search ✅
Walking route comparison ✅
Multiple alternatives ✅
Time-aware context ✅
Context explanation ✅
MapTiler + MapLibre ✅
Help points ✅
Active trips ✅
GPS tracking ✅
SSE / polling fallback ✅
Smart deviation ✅
Reports ✅
Emergency handoff ✅
Privacy controls ✅
Responsive UI ✅
Dark mode ✅
Landing-page motion ✅

Quality status

The current development workflow includes:

automated backend integration/unit coverage

frontend TypeScript validation

ESLint

backend Ruff

production frontend builds

manual browser QA for core user journeys

Contributing

Create a local copy of the repository.

Configure the required environment variables.

Run the backend and frontend locally.

Make focused changes.

Run the full frontend and backend verification commands.

Keep secrets out of Git.

Preserve the product's privacy and evidence-first principles.

Before opening a pull request, verify:

# Frontend

npx tsc -b
npm run lint
npm run build

# Backend

python -m pytest -q
ruff check .

License

Add the project's chosen license here before public release.

Acknowledgements

SaferPath builds on open mapping and civic-data ecosystems, including:

OpenStreetMap contributors

MapLibre

MapTiler

Valhalla

Open-Meteo

PostgreSQL

PostGIS

Refer to each provider's terms, attribution requirements, rate limits, and production usage policies before deployment.

Team Ignited

SaferPath — Context. Consent. Choice.

Built as a civic-tech mobility MVP for the CX1002 challenge.
