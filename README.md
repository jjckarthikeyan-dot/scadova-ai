# Scadova AI — Restaurant Voice-Agent Backend

**FastAPI · Python · Supabase · Voice-Agent Integrations**

A backend API for restaurant operations designed to support a conversational voice-agent workflow. The repository contains restaurant information lookup, menu search, and order-request data models, with Supabase as the data service.

## Technical overview

| Layer | Technology | Purpose |
| --- | --- | --- |
| API | FastAPI | HTTP endpoints and request validation |
| Models | Pydantic | Typed menu and order request schemas |
| Data | Supabase | Restaurant and menu data access |
| Configuration | python-dotenv | Environment-based settings |

## Run locally

```bash
git clone https://github.com/jjckarthikeyan-dot/scadova-ai.git
cd scadova-ai
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

For Windows, activate using `.venv\Scripts\Activate.ps1`.

Create a local `.env` file with credentials you control:

```dotenv
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-server-side-key
RESTAURANT_SLUG=your-restaurant-slug
```

**Never commit the service-role key.** The application requires these Supabase settings at startup.

```bash
uvicorn main:app --reload
```

Inspect API documentation at `http://127.0.0.1:8000/docs`. The `GET /health` endpoint is useful for a basic service check.

## Code orientation

- `main.py` — FastAPI entry point, models, and restaurant operations.
- `backend/` — Additional backend code.
- `frontend/` — Frontend assets or implementation.
- `supabase_migration.sql` and `supabase_phase2_migration.sql` — Database schema scripts.
- `requirements.txt` — Python dependencies.

## Security and current status

This is a development repository, not a demonstrated production deployment. Server-side Supabase service-role credentials must not be exposed to browser clients. Before using it with real customer details, verify authentication, authorization, input validation, retention policies, and deployment controls. Local setup and runtime behavior have not been independently tested for this documentation update.

## Maintainer

[Karthikeyan Jammalamadaka](https://github.com/jjckarthikeyan-dot)
