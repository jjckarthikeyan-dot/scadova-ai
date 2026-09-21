"""Fish Audio adapter. Credentials remain server-side; provider IDs are explicit mappings."""
import os
from urllib.parse import quote
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.admin.store import data_store, _now_iso
router = APIRouter()

FISH_AUDIO_BASE = 'https://api.fish.audio'

def fish_key():
    return os.getenv('FISH_API_KEY') or os.getenv('FISH_AUDIO_API_KEY')

async def fish_request(path, params=None):
    """Simple GET helper kept for the original credit/status/session endpoints."""
    response = await fish_api('GET', path, params=params)
    return response

async def fish_api(method, path, params=None, json_body=None, files=None, data=None):
    key = fish_key()
    if not key:
        raise HTTPException(503, 'Set FISH_API_KEY on the backend to connect Fish Audio.')
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.request(
                method,
                FISH_AUDIO_BASE + path,
                params=params,
                json=json_body,
                files=files,
                data=data,
                headers={'Authorization': f'Bearer {key}'},
            )
        if response.status_code == 404:
            raise HTTPException(404, 'Fish Audio returned 404 for ' + path + '. Check the agent ID.')
        if response.status_code in (401, 403):
            raise HTTPException(502, 'Fish Audio rejected the API key. Check FISH_API_KEY and account access.')
        if response.status_code >= 400:
            detail = (response.text or '')[:300]
            raise HTTPException(response.status_code, f'Fish Audio rejected the request (HTTP {response.status_code}): {detail}')
        if response.status_code == 204 or not response.content:
            return {}
        return response.json()
    except httpx.HTTPError:
        raise HTTPException(502, 'Fish Audio is unavailable. Try again shortly.')
    except ValueError:
        raise HTTPException(502, 'Fish Audio returned an unreadable response. Try again shortly.')

@router.get('/fish-audio/status')
async def fish_status():
    configured = bool(fish_key())
    if not configured:
        return {'configured': False, 'connected': False}
    wallet = await fish_request('/wallet/self/api-credit')
    return {'configured': True, 'connected': True, 'provider_credit': wallet.get('credit'), 'checked_at': _now_iso()}


# ============================================================
# PROVIDER AGENT DISCOVERY & DETAILS
# ============================================================

async def list_provider_agents():
    """Page through every agent in the Fish Audio workspace."""
    agents, cursor = [], None
    for _ in range(50):
        params = {'page_size': 100}
        if cursor:
            params['cursor'] = cursor
        page = await fish_request('/v1/agent/agents', params)
        agents.extend(page.get('agents', []))
        if not page.get('has_more'):
            break
        next_cursor = page.get('next_cursor')
        if not next_cursor or next_cursor == cursor:
            break
        cursor = next_cursor
    else:
        raise HTTPException(502, 'Fish Audio agent list exceeds the pagination limit.')
    return agents

@router.get('/fish-audio/agents')
async def get_provider_agents():
    """All agents available in the linked Fish Audio workspace."""
    agents = await list_provider_agents()
    linked = {s.get('fish_provider_agent_id'): k for k, s in data_store.agent_credit_settings.items() if s.get('fish_provider_agent_id')}
    for agent in agents:
        agent['local_agent_id'] = linked.get(agent.get('agent_id'))
        agent['matched_business'] = next((s.get('business_name') for k, s in data_store.agent_credit_settings.items() if s.get('fish_provider_agent_id') == agent.get('agent_id')), None)
    return {'success': True, 'count': len(agents), 'agents': agents}

@router.get('/agents/{agent_id}/fish-audio/details')
async def provider_agent_details(agent_id: str):
    """Full tracking view: provider config, recent sessions, and call analysis input."""
    settings = data_store.get_agent_credit_settings(agent_id)
    if not settings:
        raise HTTPException(404, 'Agent not found')
    provider_id = settings.get('fish_provider_agent_id')
    if not provider_id:
        raise HTTPException(400, 'Link a Fish Audio agent ID first.')
    config = await fish_request('/v1/agent/agents/' + quote(provider_id, safe='') + '/config')
    sessions = await fish_request('/v1/agent/sessions', {'agent_id': provider_id, 'status': 'completed,failed', 'page_size': 20})
    return {
        'success': True,
        'settings': settings,
        'provider_agent': {'agent_id': provider_id},
        'config': config,
        'recent_sessions': sessions.get('sessions', []),
    }


# ============================================================
# KNOWLEDGE SOURCES (WORKSPACE LIBRARY)
# ============================================================

@router.get('/fish-audio/knowledge/sources')
async def list_knowledge_sources():
    sources = await fish_request('/v1/agent/knowledge-sources')
    items = sources.get('sources') or sources.get('items') or (sources if isinstance(sources, list) else [])
    return {'success': True, 'count': len(items), 'sources': items}

@router.get('/fish-audio/knowledge/sources/{source_id}')
async def get_knowledge_source(source_id: str):
    return await fish_request('/v1/agent/knowledge-sources/' + quote(source_id, safe=''))


# ============================================================
# PER-AGENT KNOWLEDGE BASE (DASHBOARD EDIT -> FISH AUDIO PUSH)
# ============================================================

class KnowledgeProfile(BaseModel):
    profile: dict = Field(default_factory=dict)
    services: list = Field(default_factory=list)
    offers: list = Field(default_factory=list)
    documents: list = Field(default_factory=list)
    extra_markdown: str = Field(default='', max_length=400000)

@router.get('/agents/{agent_id}/knowledge')
async def get_agent_knowledge(agent_id: str):
    record = data_store.get_provider_knowledge(agent_id)
    if not record:
        raise HTTPException(404, 'Agent not found')
    return {'success': True, 'knowledge': record}

@router.put('/agents/{agent_id}/knowledge')
async def save_agent_knowledge(agent_id: str, payload: KnowledgeProfile):
    record = data_store.set_provider_knowledge(agent_id, payload.model_dump(exclude_unset=False))
    return {'success': True, 'knowledge': record}

def _bullets(title, items):
    lines = [f'## {title}'] if title else []
    for item in items:
        text = ' '.join(str(v).strip() for v in item.values() if str(v or '').strip())
        if text:
            lines.append(f'- {text}')
    return lines

def build_knowledge_markdown(record, settings):
    """Render the dashboard knowledge profile into Fish Audio markdown."""
    agent = record.get('profile') or {}
    lines = [f"# {record.get('business_name') or settings.get('business_name') or 'Business'} — Agent Knowledge"]
    if agent.get('description'):
        lines += ['', agent['description'].strip()]
    if agent.get('hours'):
        lines += ['', '## Business hours', agent['hours'].strip()]
    if agent.get('policies'):
        lines += ['', '## Policies', agent['policies'].strip()]
    for entry in record.get('services') or []:
        name = str(entry.get('name') or '').strip()
        if not name:
            continue
        lines.append('')
        lines.append(f"## Service: {name}")
        if entry.get('description'):
            lines.append(str(entry['description']).strip())
        if entry.get('price'):
            lines.append(f"Price: {entry['price']}")
        if entry.get('availability'):
            lines.append(f"Availability: {entry['availability']}")
    offers = [o for o in record.get('offers') or [] if str(o.get('title') or '').strip()]
    if offers:
        lines += ['', '## Current offers (mention these when relevant)']
        for offer in offers:
            parts = [str(offer.get(k) or '').strip() for k in ('title', 'details', 'valid_until')]
            lines.append('- ' + ' — '.join(p for p in parts if p))
    for doc in record.get('documents') or []:
        name = str(doc.get('name') or '').strip()
        content = str(doc.get('content') or '').strip()
        if not name or not content:
            continue
        lines += ['', f"## Document: {name}", content]
    if str(record.get('extra_markdown') or '').strip():
        lines += ['', str(record['extra_markdown']).strip()]
    return ('\n'.join(lines) + '\n').strip() + '\n'

class KnowledgePush(KnowledgeProfile):
    publish: bool = False
    source_name: str = Field(default='', max_length=160)
    overwrite_provider_source: bool = True

@router.post('/agents/{agent_id}/knowledge/push')
async def push_agent_knowledge(agent_id: str, payload: KnowledgePush):
    """
    Build markdown from the dashboard knowledge profile, create or update the
    Fish Audio knowledge source, attach it to the linked provider agent, and
    optionally publish so live sessions pick it up immediately.
    """
    settings = data_store.get_agent_credit_settings(agent_id)
    if not settings:
        raise HTTPException(404, 'Agent not found')
    provider_id = settings.get('fish_provider_agent_id')
    if not provider_id:
        raise HTTPException(400, 'Link a Fish Audio agent ID first.')
    # Persist the editor state first: what the dashboard shows is exactly what gets pushed.
    editor_updates = payload.model_dump(exclude={'publish', 'source_name', 'overwrite_provider_source'})
    record = data_store.set_provider_knowledge(agent_id, editor_updates)
    markdown = build_knowledge_markdown(record, settings)
    if len(markdown.encode('utf-8')) > 1_000_000:
        raise HTTPException(422, 'Knowledge content exceeds the Fish Audio 1 MB source limit. Trim documents.')
    profile = record.get('profile') or {}
    if not profile.get('description') and not record.get('services') and not record.get('offers') and not record.get('documents') and not str(record.get('extra_markdown') or '').strip():
        raise HTTPException(422, 'Add hours, services, an offer, a document, or extra notes before pushing.')

    source_id = record.get('provider_source_id') if payload.overwrite_provider_source else None
    verified = False
    if source_id:
        try:
            await fish_api('PATCH', '/v1/agent/knowledge-sources/' + quote(source_id, safe=''),
                           files={'source': ('knowledge.md', markdown.encode('utf-8'), 'text/markdown')})
            verified = True
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
            source_id = None  # source vanished on the provider; recreate below
    if not source_id:
        name = payload.source_name.strip() or f"{settings.get('business_name') or settings.get('agent_name') or 'Agent'} knowledge"
        created = await fish_api('POST', '/v1/agent/knowledge-sources',
                                 files={'source': ('knowledge.md', markdown.encode('utf-8'), 'text/markdown')},
                                 data={'name': name, 'description': f"Managed by Scadova dashboard for {settings.get('agent_name')}"})
        source_id = created.get('knowledge_source_id') or created.get('source_id') or created.get('id')
        if not source_id:
            raise HTTPException(502, 'Fish Audio did not return a knowledge source ID.')
        verified = True

    await fish_api('PATCH', '/v1/agent/agents/' + quote(provider_id, safe='') + '/config',
                   json_body={'knowledge_base': {'enabled': True, 'knowledge_source_ids': [source_id]}})
    published_version = None
    if payload.publish:
        published = await fish_api('POST', '/v1/agent/agents/' + quote(provider_id, safe='') + '/publish',
                                   json_body={'version_title': 'Knowledge update from Scadova dashboard'})
        published_version = published.get('version_number')

    with data_store.state_lock:
        record = data_store.get_provider_knowledge(agent_id)
        record['provider_source_id'] = source_id
        record['provider_agent_id'] = provider_id
        record['last_pushed_at'] = _now_iso()
        record['last_published_version'] = published_version or record.get('last_published_version')
        record['push_history'] = ([{'at': _now_iso(), 'published': payload.publish, 'version': published_version, 'source_id': source_id}] + (record.get('push_history') or []))[:20]
        data_store.set_provider_knowledge(agent_id, record)
    return {'success': True, 'provider_source_id': source_id, 'provider_agent_id': provider_id, 'published_version': published_version, 'chars': len(markdown), 'verified_on_provider': verified}

@router.get('/agents/{agent_id}/knowledge/provider')
async def provider_knowledge_state(agent_id: str):
    """Read back the provider-side attach state for this agent's knowledge source."""
    settings = data_store.get_agent_credit_settings(agent_id)
    if not settings:
        raise HTTPException(404, 'Agent not found')
    provider_id = settings.get('fish_provider_agent_id')
    record = data_store.get_provider_knowledge(agent_id)
    source_id = record.get('provider_source_id')
    if not provider_id or not source_id:
        return {'success': True, 'linked': False}
    dependents = await fish_request('/v1/agent/knowledge-sources/' + quote(source_id, safe='') + '/agents')
    return {'success': True, 'linked': True, 'provider_agent_id': provider_id, 'source_id': source_id, 'dependents': dependents}


# ============================================================
# LINKING & USAGE SYNC (EXISTING)
# ============================================================

class FishLink(BaseModel):
    fish_agent_id: str = Field(min_length=1, max_length=160, pattern=r'^[a-zA-Z0-9_-]+$')

@router.put('/agents/{agent_id}/fish-audio')
async def link_fish(agent_id: str, payload: FishLink):
    settings = data_store.get_agent_credit_settings(agent_id)
    if not settings:
        raise HTTPException(404, 'Agent not found')
    # Verify the provider object before persisting the mapping.
    await fish_request('/v1/agent/agents/' + quote(payload.fish_agent_id, safe=''))
    with data_store.state_lock:
        settings = data_store.get_agent_credit_settings(agent_id)
        if any(s.get('fish_provider_agent_id') == payload.fish_agent_id and k != settings['agent_id'] for k,s in data_store.agent_credit_settings.items()):
            raise HTTPException(409, 'This Fish Audio agent is already linked to another local agent.')
        old = settings.get('fish_provider_agent_id')
        if old and old != payload.fish_agent_id:
            raise HTTPException(409, 'This agent already has a provider mapping. Create a separate agent to preserve usage history.')
        settings['fish_provider_agent_id'] = payload.fish_agent_id
        data_store.agent_credit_settings[settings['agent_id']] = settings
        data_store.persist_usage()
    return {'success': True, 'settings': settings}

@router.post('/agents/{agent_id}/fish-audio/sync')
async def sync_fish(agent_id: str):
    settings = data_store.get_agent_credit_settings(agent_id)
    if not settings or not settings.get('fish_provider_agent_id'):
        raise HTTPException(400, 'Link a Fish Audio agent ID first.')
    records, cursor = [], None
    for _ in range(100):
        params = {'agent_id': settings['fish_provider_agent_id'], 'status': 'completed,failed', 'page_size': 100}
        if cursor: params['cursor'] = cursor
        page = await fish_request('/v1/agent/sessions', params)
        records.extend(page.get('sessions', []))
        if not page.get('has_more'): break
        next_cursor = page.get('next_cursor')
        if not next_cursor or next_cursor == cursor:
            raise HTTPException(502, 'Fish Audio returned an invalid pagination cursor. No sessions were imported.')
        cursor = next_cursor
    else:
        raise HTTPException(502, 'Session history exceeds the sync limit. No sessions were imported.')
    imported = 0
    with data_store.state_lock:
        settings = data_store.get_agent_credit_settings(agent_id)
        known = {c.get('provider_session_id') for c in data_store.local_calls}
        for session in records:
            sid = session.get('session_id')
            seconds = session.get('duration_seconds')
            if not sid or sid in known or seconds is None or seconds < 0 or session.get('agent_id') != settings['fish_provider_agent_id']:
                continue
            data_store.add_call({'agent_id': settings['agent_id'], 'business_id': settings['business_id'], 'business_name': settings['business_name'], 'agent_name': settings['agent_name'], 'provider_session_id': sid, 'provider': 'fish_audio', 'fish_provider_agent_id': settings['fish_provider_agent_id'], 'duration_seconds': seconds, 'start_time': session.get('started_at') or session.get('created_at'), 'outcome': session.get('status', 'unknown'), 'direction': session.get('direction'), 'caller': session.get('caller_number') or '', 'latency_ms': None})
            known.add(sid); imported += 1
        settings['last_provider_sync'] = _now_iso()
        data_store.agent_credit_settings[settings['agent_id']] = settings
        data_store.persist_usage()
    return {'success': True, 'imported': imported, 'usage': data_store.get_agent_usage_summary()}

class MinuteTopUp(BaseModel):
    minutes: float = Field(gt=0, allow_inf_nan=False)

@router.post('/agents/{agent_id}/minutes')
async def top_up_minutes(agent_id: str, payload: MinuteTopUp):
    with data_store.state_lock:
        settings = data_store.get_agent_credit_settings(agent_id)
        if not settings: raise HTTPException(404, 'Agent not found')
        if settings['credits_per_minute'] <= 0: raise HTTPException(422, 'Set a positive credits-per-minute rate before adding minutes.')
        try:
            saved = data_store.add_agent_credits(agent_id, round(payload.minutes * settings['credits_per_minute'], 4), f'{payload.minutes:g} minute allocation')
        except ValueError as exc:
            raise HTTPException(400, str(exc))
    return {'success': True, 'settings': saved}
