"""Fish Audio adapter. Credentials remain server-side; provider IDs are explicit mappings."""
import os
import json
import logging
from urllib.parse import quote
from typing import Dict, List, Optional, Any
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.admin.store import data_store, _now_iso

logger = logging.getLogger("fish_audio")
router = APIRouter()

FISH_AUDIO_BASE = 'https://api.fish.audio'
DEFAULT_FISH_VOICE_ID = 'e80db686476f4ccda758da35cacfb993'

def fish_key():
    return os.getenv('FISH_API_KEY') or os.getenv('FISH_AUDIO_API_KEY')

def get_public_base_url() -> str:
    url = (
        os.getenv('PUBLIC_API_URL')
        or os.getenv('RENDER_EXTERNAL_URL')
        or 'https://scadova-ai.onrender.com'
    ).rstrip('/')
    if 'localhost' in url or '127.0.0.1' in url:
        return 'https://scadova-ai.onrender.com'
    return url

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


# ============================================================
# FISH AUDIO WEBHOOK TOOLS & LIVE AGENT AUTO-PROVISIONING
# ============================================================

def build_tool_definition(tool_name: str, business_key: str, business_name: str, base_url: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Build canonical webhook tool payload for Fish Audio."""
    base = (base_url or get_public_base_url()).rstrip('/')
    b_name = business_name or 'Business'
    b_key = business_key or 'default'

    if tool_name == 'get_services':
        return {
            'name': 'get_services',
            'description': f'Retrieve active services currently offered by {b_name}, including descriptions and prices.',
            'tool_type': 'webhook',
            'method': 'GET',
            'url': f'{base}/api/appointment-booking/services/{b_key}',
            'arguments': [],
            'content_type': 'application/json',
            'body_template': '',
            'headers': [],
            'timeout_seconds': 30,
            'error_handling': 'passthrough',
            'expects_response': True,
            'execution_mode': 'blocking',
        }

    elif tool_name == 'get_service_details':
        return {
            'name': 'get_service_details',
            'description': f'Get detailed information, full description, price, and duration for a specific service at {b_name} by service name or numeric ID.',
            'tool_type': 'webhook',
            'method': 'GET',
            'url': f'{base}/api/appointment-booking/services/{b_key}/{{service_id}}',
            'arguments': [
                {'name': 'service_id', 'description': 'The name or numeric ID of the service to look up (e.g. Automation, VoicePilot, or 1)'}
            ],
            'content_type': 'application/json',
            'body_template': '',
            'headers': [],
            'timeout_seconds': 30,
            'error_handling': 'passthrough',
            'expects_response': True,
            'execution_mode': 'blocking',
        }

    elif tool_name == 'get_pricing':
        return {
            'name': 'get_pricing',
            'description': f'Get pricing, consultation fees, and duration for all active services at {b_name}.',
            'tool_type': 'webhook',
            'method': 'GET',
            'url': f'{base}/api/appointment-booking/pricing/{b_key}',
            'arguments': [],
            'content_type': 'application/json',
            'body_template': '',
            'headers': [],
            'timeout_seconds': 30,
            'error_handling': 'passthrough',
            'expects_response': True,
            'execution_mode': 'blocking',
        }

    elif tool_name in ('get_business_hours', 'get_hours'):
        return {
            'name': tool_name,
            'description': f'Get operating hours, opening and closing times for each day of the week for {b_name}.',
            'tool_type': 'webhook',
            'method': 'GET',
            'url': f'{base}/api/appointment-booking/hours/{b_key}',
            'arguments': [],
            'content_type': 'application/json',
            'body_template': '',
            'headers': [],
            'timeout_seconds': 30,
            'error_handling': 'passthrough',
            'expects_response': True,
            'execution_mode': 'blocking',
        }

    elif tool_name == 'create_appointment':
        body = json.dumps({
            'business_id': b_key,
            'customer_name': '{{customer_name}}',
            'customer_phone': '{{customer_phone}}',
            'customer_email': '{{customer_email}}',
            'appointment_date': '{{appointment_date}}',
            'appointment_time': '{{appointment_time}}',
            'service_name': '{{service_name}}',
            'notes': '{{notes}}'
        }, indent=2)
        return {
            'name': 'create_appointment',
            'description': f'Book a new appointment at {b_name}. Returns confirmed appointment ID reference and details.',
            'tool_type': 'webhook',
            'method': 'POST',
            'url': f'{base}/api/appointment-booking/appointments',
            'arguments': [
                {'name': 'customer_name', 'description': 'Full name of the customer'},
                {'name': 'customer_phone', 'description': 'Customer phone number (e.g. +1234567890)'},
                {'name': 'customer_email', 'description': 'Customer email address for confirmations (optional)'},
                {'name': 'appointment_date', 'description': 'Appointment date in YYYY-MM-DD format'},
                {'name': 'appointment_time', 'description': 'Appointment time in HH:MM format (24-hour, e.g. 10:00 or 14:30)'},
                {'name': 'service_name', 'description': 'Name of requested service or consultation'},
                {'name': 'notes', 'description': 'Optional notes or customer requests'}
            ],
            'content_type': 'application/json',
            'body_template': body,
            'headers': [],
            'timeout_seconds': 30,
            'error_handling': 'passthrough',
            'expects_response': True,
            'execution_mode': 'blocking',
        }

    elif tool_name == 'search_appointment':
        body = json.dumps({
            'business_id': b_key,
            'appointment_id': '{{appointment_id}}',
            'customer_phone': '{{customer_phone}}',
            'customer_name': '{{customer_name}}',
            'appointment_date': '{{appointment_date}}'
        }, indent=2)
        return {
            'name': 'search_appointment',
            'description': f'Search and look up existing appointment details for {b_name} by appointment ID, phone, name, or date.',
            'tool_type': 'webhook',
            'method': 'POST',
            'url': f'{base}/api/appointment-booking/appointments/search',
            'arguments': [
                {'name': 'appointment_id', 'description': 'Appointment reference ID if provided (e.g. SCA2692101)'},
                {'name': 'customer_phone', 'description': 'Customer phone number to search for'},
                {'name': 'customer_name', 'description': 'Customer name to search for'},
                {'name': 'appointment_date', 'description': 'Date of the appointment in YYYY-MM-DD format'}
            ],
            'content_type': 'application/json',
            'body_template': body,
            'headers': [],
            'timeout_seconds': 30,
            'error_handling': 'passthrough',
            'expects_response': True,
            'execution_mode': 'blocking',
        }

    elif tool_name == 'reschedule_appointment':
        body = json.dumps({
            'business_id': b_key,
            'appointment_id': '{{appointment_id}}',
            'new_date': '{{new_date}}',
            'new_time': '{{new_time}}',
            'reason': '{{reason}}'
        }, indent=2)
        return {
            'name': 'reschedule_appointment',
            'description': f'Reschedule an existing confirmed appointment for {b_name} to a new date and time.',
            'tool_type': 'webhook',
            'method': 'PUT',
            'url': f'{base}/api/appointment-booking/appointments/reschedule',
            'arguments': [
                {'name': 'appointment_id', 'description': 'Appointment reference ID (e.g. SCA2692101)'},
                {'name': 'new_date', 'description': 'New requested date in YYYY-MM-DD format'},
                {'name': 'new_time', 'description': 'New requested time in HH:MM format (24-hour, e.g. 15:00)'},
                {'name': 'reason', 'description': 'Reason for rescheduling (optional)'}
            ],
            'content_type': 'application/json',
            'body_template': body,
            'headers': [],
            'timeout_seconds': 30,
            'error_handling': 'passthrough',
            'expects_response': True,
            'execution_mode': 'blocking',
        }

    elif tool_name == 'cancel_appointment':
        body = json.dumps({
            'business_id': b_key,
            'appointment_id': '{{appointment_id}}',
            'reason': '{{reason}}'
        }, indent=2)
        return {
            'name': 'cancel_appointment',
            'description': f'Cancel an existing confirmed appointment for {b_name} using its appointment reference ID.',
            'tool_type': 'webhook',
            'method': 'PUT',
            'url': f'{base}/api/appointment-booking/appointments/cancel',
            'arguments': [
                {'name': 'appointment_id', 'description': 'Appointment reference ID to cancel (e.g. SCA2692101)'},
                {'name': 'reason', 'description': 'Reason for cancellation'}
            ],
            'content_type': 'application/json',
            'body_template': body,
            'headers': [],
            'timeout_seconds': 30,
            'error_handling': 'passthrough',
            'expects_response': True,
            'execution_mode': 'blocking',
        }

    elif tool_name == 'get_menu':
        return {
            'name': 'get_menu',
            'description': f'Retrieve menu categories, dishes, descriptions, and prices for {b_name}.',
            'tool_type': 'webhook',
            'method': 'GET',
            'url': f'{base}/api/restaurant/menu/categories/{b_key}',
            'arguments': [],
            'content_type': 'application/json',
            'body_template': '',
            'headers': [],
            'timeout_seconds': 30,
            'error_handling': 'passthrough',
            'expects_response': True,
            'execution_mode': 'blocking',
        }

    elif tool_name == 'get_item':
        body = json.dumps({
            'business_id': b_key,
            'item_name': '{{item_name}}'
        }, indent=2)
        return {
            'name': 'get_item',
            'description': f'Get detailed item information, price, dietary flags, and ingredients for a menu item at {b_name}.',
            'tool_type': 'webhook',
            'method': 'POST',
            'url': f'{base}/api/restaurant/menu/item',
            'arguments': [
                {'name': 'item_name', 'description': 'Name of menu item or dish'}
            ],
            'content_type': 'application/json',
            'body_template': body,
            'headers': [],
            'timeout_seconds': 30,
            'error_handling': 'passthrough',
            'expects_response': True,
            'execution_mode': 'blocking',
        }

    elif tool_name == 'create_order':
        body = json.dumps({
            'business_id': b_key,
            'customer_name': '{{customer_name}}',
            'customer_phone': '{{customer_phone}}',
            'items': '{{items}}'
        }, indent=2)
        return {
            'name': 'create_order',
            'description': f'Place a food order for {b_name}.',
            'tool_type': 'webhook',
            'method': 'POST',
            'url': f'{base}/api/restaurant/orders/create',
            'arguments': [
                {'name': 'customer_name', 'description': 'Customer name'},
                {'name': 'customer_phone', 'description': 'Customer phone number'},
                {'name': 'items', 'description': 'Ordered items description or list'}
            ],
            'content_type': 'application/json',
            'body_template': body,
            'headers': [],
            'timeout_seconds': 30,
            'error_handling': 'passthrough',
            'expects_response': True,
            'execution_mode': 'blocking',
        }

    elif tool_name == 'create_loan_application':
        body = json.dumps({
            'business_id': b_key,
            'applicant_name': '{{applicant_name}}',
            'mobile_number': '{{mobile_number}}',
            'loan_type': '{{loan_type}}',
            'loan_amount': '{{loan_amount}}'
        }, indent=2)
        return {
            'name': 'create_loan_application',
            'description': f'Submit an initial loan inquiry and application for {b_name}.',
            'tool_type': 'webhook',
            'method': 'POST',
            'url': f'{base}/api/loan-agency/applications',
            'arguments': [
                {'name': 'applicant_name', 'description': 'Full name of applicant'},
                {'name': 'mobile_number', 'description': 'Mobile phone number'},
                {'name': 'loan_type', 'description': 'Type of loan (personal_loan, business_loan, used_car_loan)'},
                {'name': 'loan_amount', 'description': 'Requested loan amount in rupees'}
            ],
            'content_type': 'application/json',
            'body_template': body,
            'headers': [],
            'timeout_seconds': 30,
            'error_handling': 'passthrough',
            'expects_response': True,
            'execution_mode': 'blocking',
        }

    elif tool_name == 'create_callback':
        body = json.dumps({
            'business_id': b_key,
            'customer_name': '{{customer_name}}',
            'phone_number': '{{phone_number}}',
            'preferred_time': '{{preferred_time}}',
            'notes': '{{notes}}'
        }, indent=2)
        return {
            'name': 'create_callback',
            'description': f'Schedule a specialist callback for a customer for {b_name}.',
            'tool_type': 'webhook',
            'method': 'POST',
            'url': f'{base}/api/loan-agency/callbacks',
            'arguments': [
                {'name': 'customer_name', 'description': 'Customer name'},
                {'name': 'phone_number', 'description': 'Phone number for callback'},
                {'name': 'preferred_time', 'description': 'Preferred callback time'},
                {'name': 'notes', 'description': 'Reason for callback'}
            ],
            'content_type': 'application/json',
            'body_template': body,
            'headers': [],
            'timeout_seconds': 30,
            'error_handling': 'passthrough',
            'expects_response': True,
            'execution_mode': 'blocking',
        }

    # Generic webhook fallback
    return {
        'name': tool_name,
        'description': f'Action tool {tool_name} for {b_name}.',
        'tool_type': 'webhook',
        'method': 'POST',
        'url': f'{base}/api/appointment-booking/appointments',
        'arguments': [],
        'content_type': 'application/json',
        'body_template': json.dumps({'business_id': b_key, 'action': tool_name}),
        'headers': [],
        'timeout_seconds': 30,
        'error_handling': 'passthrough',
        'expects_response': True,
        'execution_mode': 'blocking',
    }


async def list_workspace_tools() -> List[Dict[str, Any]]:
    """List all webhook tools currently registered in the Fish Audio workspace."""
    try:
        res = await fish_api('GET', '/v1/agent/tools')
        return res.get('tools', []) if isinstance(res, dict) else []
    except Exception as e:
        logger.warning(f'Could not list workspace tools: {e}')
        return []


async def ensure_fish_tools(business_key: str, business_name: str, tool_names: List[str]) -> List[str]:
    """
    Ensure each tool in tool_names exists in Fish Audio for this business.
    Reuses matching existing workspace tools where possible or creates them.
    Returns list of Fish Audio tool_ids.
    """
    if not fish_key() or not tool_names:
        return []

    existing_tools = await list_workspace_tools()
    tool_ids: List[str] = []

    for t_name in tool_names:
        t_name = t_name.strip()
        if not t_name:
            continue

        matched_id = None
        # Check if an existing tool matches this name and business key
        for ext in existing_tools:
            if ext.get('name') == t_name:
                url_match = business_key in str(ext.get('url', ''))
                body_match = business_key in str(ext.get('body_template', ''))
                desc_match = business_key in str(ext.get('description', ''))
                if url_match or body_match or desc_match:
                    matched_id = ext.get('tool_id')
                    break

        if matched_id:
            tool_ids.append(matched_id)
            continue

        # Build definition and create in Fish Audio
        definition = build_tool_definition(t_name, business_key, business_name)
        if not definition:
            continue

        try:
            created = await fish_api('POST', '/v1/agent/tools', json_body=definition)
            created_id = created.get('tool_id')
            if created_id:
                tool_ids.append(created_id)
                logger.info(f"Registered Fish Audio tool '{t_name}' ({created_id}) for {business_name}")
        except Exception as e:
            logger.error(f"Failed to create Fish Audio tool '{t_name}' for {business_name}: {e}")

    return tool_ids


async def create_fish_agent(
    business_name: str,
    business_key: str,
    agent_name: str,
    system_prompt: str,
    first_message: str,
    voice_id: Optional[str] = None,
    language: str = 'en',
    tool_ids: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Create a new AI Voice Agent in Fish Audio workspace, attach its tools,
    and publish it so it becomes Live.
    """
    resolved_voice_id = voice_id
    if not resolved_voice_id or resolved_voice_id == 'fish_audio_default' or len(resolved_voice_id) != 32:
        resolved_voice_id = DEFAULT_FISH_VOICE_ID

    tool_ids = tool_ids or []

    payload = {
        'name': agent_name,
        'description': f'AI Voice Agent for {business_name} ({business_key}) — Scadova AI',
        'config': {
            'prompt': {
                'system_prompt': system_prompt,
                'first_message_mode': 'prompt',
                'first_message': first_message,
                'first_message_prompt': first_message,
            },
            'voice': {
                'voice_id': resolved_voice_id,
                'speaking_language': language or 'en',
                'expressive': True,
                'speed': 1.0,
            },
            'conversation': {
                'max_duration_seconds': 1800,
                'eagerness': 'balanced',
                'interruptible': True,
                'record_audio': True,
            },
            'tools': {
                'enabled': bool(tool_ids),
                'tool_ids': tool_ids,
                'system_tools': {'hang_up_call': False}
            },
            'llm': {
                'model': 'google/gemini-3.5-flash-lite'
            }
        }
    }

    created = await fish_api('POST', '/v1/agent/agents', json_body=payload)
    agent_id = created.get('agent_id')
    if not agent_id:
        raise HTTPException(502, 'Fish Audio did not return an agent_id.')

    # Automatically publish so the agent status is Live
    published_version = None
    try:
        pub = await fish_api(
            'POST',
            f'/v1/agent/agents/{agent_id}/publish',
            json_body={'version_title': 'Initial Scadova provision'}
        )
        published_version = pub.get('version_number')
    except Exception as pub_err:
        logger.warning(f'Fish Audio publish note for {agent_id}: {pub_err}')

    return {
        'agent_id': agent_id,
        'tool_ids': tool_ids,
        'published_version': published_version,
        'status': 'active'
    }


async def update_fish_agent_config(
    fish_agent_id: str,
    system_prompt: Optional[str] = None,
    first_message: Optional[str] = None,
    voice_id: Optional[str] = None,
    language: Optional[str] = None,
    tool_ids: Optional[List[str]] = None,
    publish: bool = True
) -> Dict[str, Any]:
    """
    Patch configuration on an existing Fish Audio agent and optionally republish.
    """
    if not fish_key() or not fish_agent_id:
        return {'success': False, 'reason': 'No Fish Audio key or agent ID'}

    patch_config: Dict[str, Any] = {}
    if system_prompt or first_message:
        prompt_patch: Dict[str, Any] = {}
        if system_prompt:
            prompt_patch['system_prompt'] = system_prompt
        if first_message:
            prompt_patch['first_message'] = first_message
            prompt_patch['first_message_prompt'] = first_message
            prompt_patch['first_message_mode'] = 'prompt'
        patch_config['prompt'] = prompt_patch

    if voice_id or language:
        voice_patch: Dict[str, Any] = {}
        if voice_id:
            resolved = voice_id if (voice_id != 'fish_audio_default' and len(voice_id) == 32) else DEFAULT_FISH_VOICE_ID
            voice_patch['voice_id'] = resolved
        if language:
            voice_patch['speaking_language'] = language
        patch_config['voice'] = voice_patch

    if tool_ids is not None:
        patch_config['tools'] = {
            'enabled': bool(tool_ids),
            'tool_ids': tool_ids,
            'system_tools': {'hang_up_call': False}
        }

    if not patch_config:
        return {'success': True, 'updated': False}

    await fish_api('PATCH', f'/v1/agent/agents/{quote(fish_agent_id, safe="")}/config', json_body=patch_config)

    published_version = None
    if publish:
        try:
            pub = await fish_api(
                'POST',
                f'/v1/agent/agents/{quote(fish_agent_id, safe="")}/publish',
                json_body={'version_title': 'Updated from Scadova Admin'}
            )
            published_version = pub.get('version_number')
        except Exception as e:
            logger.warning(f'Republish note for {fish_agent_id}: {e}')

    return {
        'success': True,
        'updated': True,
        'agent_id': fish_agent_id,
        'published_version': published_version
    }


@router.get('/fish-audio/tools')
async def get_fish_tools():
    """List all registered webhook tools in the Fish Audio workspace."""
    tools = await list_workspace_tools()
    return {'success': True, 'count': len(tools), 'tools': tools}


@router.post('/fish-audio/businesses/{business_id}/provision')
async def provision_business_fish_agent(business_id: str):
    """
    Manually trigger or re-provision live Fish Audio webhook tools and agent
    for an existing registered business.
    """
    biz = data_store.get_business(business_id)
    if not biz:
        raise HTTPException(404, f"Business '{business_id}' not found")

    biz_id = biz.get('id')
    biz_name = biz.get('name', 'Business')
    b_key = biz.get('business_key') or f'biz_{biz_id}'
    agent_name = biz.get('agent_name') or f'{biz_name} AI Specialist'
    system_prompt = biz.get('system_prompt') or f'You are the voice assistant for {biz_name}.'
    first_message = biz.get('first_message') or f'Hello, welcome to {biz_name}. How can I help you today?'
    voice_id = biz.get('voice_id')
    language = biz.get('language') or 'en'
    tool_names = biz.get('attached_tools') or [
        'get_services', 'get_service_details', 'get_pricing', 'get_business_hours',
        'create_appointment', 'search_appointment', 'reschedule_appointment', 'cancel_appointment'
    ]

    # 1. Ensure tools exist in Fish Audio
    tool_ids = await ensure_fish_tools(b_key, biz_name, tool_names)

    # 2. Create or update agent in Fish Audio
    existing_fish_id = biz.get('fish_agent_id')
    is_real_uuid = existing_fish_id and len(existing_fish_id) == 32 and not existing_fish_id.startswith('agent_')

    if is_real_uuid:
        await update_fish_agent_config(
            fish_agent_id=existing_fish_id,
            system_prompt=system_prompt,
            first_message=first_message,
            voice_id=voice_id,
            language=language,
            tool_ids=tool_ids,
            publish=True
        )
        res_agent_id = existing_fish_id
    else:
        created = await create_fish_agent(
            business_name=biz_name,
            business_key=b_key,
            agent_name=agent_name,
            system_prompt=system_prompt,
            first_message=first_message,
            voice_id=voice_id,
            language=language,
            tool_ids=tool_ids
        )
        res_agent_id = created.get('agent_id')

    # Update business and agent record in Supabase & data_store
    updates = {
        'fish_agent_id': res_agent_id,
        'agent_id': res_agent_id,
        'attached_tool_ids': tool_ids,
        'attached_tools': tool_names,
        'status': 'active'
    }
    data_store.update_business(biz_id, updates)

    return {
        'success': True,
        'message': f'Successfully provisioned Fish Audio agent and {len(tool_ids)} tools for {biz_name}',
        'fish_agent_id': res_agent_id,
        'tool_ids': tool_ids,
        'business': data_store.get_business(biz_id)
    }
