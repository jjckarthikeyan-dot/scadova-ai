"""Scadova AI conversation rules and business-router tool registry."""
from typing import Dict, Any, List


BASE_CONVERSATION_RULES = """### CORE VOICE CONVERSATION RULES:
1. ASK ONE QUESTION AT A TIME: Never ask multiple questions in a single turn. Keep utterances concise, conversational, and direct.
2. NAME SPELLING VERIFICATION: When capturing the customer's full name, politely repeat the name and spell back ambiguous or complex names to confirm accuracy.
3. PHONE DIGIT VERIFICATION: When collecting phone numbers, repeat back the digits clearly in groups (e.g., "That's 205, 549, 3374, correct?").
4. EMAIL VERIFICATION: Spell back email addresses including domain (e.g., "john dot doe at gmail dot com") to verify accuracy.
5. NAME & EMAIL CROSS-CHECK: Confirm that the provided email matches the customer's provided name before submitting bookings or applications.
6. INTERRUPTION HANDLING: If the caller interrupts you while speaking, immediately stop, listen attentively, acknowledge what they said, and answer their new query gracefully.
7. SILENCE HANDLING: If the caller is silent for more than 5 seconds, politely prompt them: "Are you still there? Take your time, I am right here to help."
8. TIMEZONE HANDLING: Always specify the business timezone when discussing dates, operating hours, or booking slots so there is zero confusion.
9. APPOINTMENT BOOKING RULES: Ensure all required fields (customer name, customer phone, date, time slot, service) are explicitly validated before invoking booking tools.
10. APPOINTMENT ID RULES: Always recite generated appointment IDs clearly and advise the caller to save it for reference.
11. RESCHEDULE RULES: Search and confirm the existing appointment ID and verify customer identity before applying any date or time updates.
12. CANCELLATION RULES: Confirm cancellation intent twice before marking an appointment or reservation as CANCELLED.
13. ZERO HALLUCINATION ON PRICING: NEVER invent, discount, or estimate prices. Only quote exact prices returned by tools or present in the official services catalogue.
14. ZERO HALLUCINATION ON SERVICES: Do not invent services, menus, or loan terms outside of the business's provided inventory.
15. ZERO HALLUCINATION ON INTEGRATIONS: Do not claim third-party integrations or features unless officially confirmed in the configuration.
16. FINAL CONFIRMATION RULES: Prior to completing any transaction, summarize all details (Name, Service/Item, Date, Time, Contact details) and secure caller confirmation."""


def build_system_prompt(
    business_data: Dict[str, Any],
    agent_data: Dict[str, Any],
    hours_data: List[Dict[str, Any]],
    services_data: List[Dict[str, Any]],
    features_data: List[str]
) -> str:
    """Compile a local conversation guide for a Scadova voice agent."""
    biz_name = business_data.get("name", "Our Business")
    biz_type = business_data.get("type", "service_and_appointment")
    biz_tz = business_data.get("timezone", "UTC")
    biz_phone = business_data.get("phone", "N/A")
    biz_desc = business_data.get("description", "")
    
    agent_name = agent_data.get("name", "Voice Assistant")
    agent_role = agent_data.get("role", "Appointment Booking Specialist")
    first_message = agent_data.get("first_message", f"Hello! Thank you for calling {biz_name}. How can I assist you today?")

    # Format operating hours
    hours_text_lines = []
    for h in hours_data or []:
        day = h.get("day", "").capitalize()
        if h.get("closed"):
            hours_text_lines.append(f"- {day}: Closed")
        else:
            open_t = h.get("open_time", "09:00")
            close_t = h.get("close_time", "18:00")
            hours_text_lines.append(f"- {day}: {open_t} to {close_t}")
    hours_block = "\n".join(hours_text_lines) if hours_text_lines else "Standard Business Hours: Monday to Friday 9:00 AM - 6:00 PM."

    # Format catalogue / products
    items_text_lines = []
    for s in services_data or []:
        name = s.get("service_name") or s.get("item_name") or s.get("loan_product") or s.get("name", "Service")
        price = s.get("price") or s.get("interest_info") or ""
        desc = s.get("short_description") or s.get("description") or ""
        dur = f" ({s.get('duration_minutes')} mins)" if s.get('duration_minutes') else ""
        items_text_lines.append(f"- {name}{dur}: {f'${price}' if str(price).replace('.', '').isdigit() else price} - {desc}")
    items_block = "\n".join(items_text_lines) if items_text_lines else "No catalogue items currently listed."

    # Active features
    features_block = ", ".join(features_data) if features_data else "All standard voice capabilities enabled."

    prompt = f"""You are {agent_name}, the professional voice agent for {biz_name}.
Role: {agent_role}
Business Type: {biz_type}
Timezone: {biz_tz}
Business Telephone: {biz_phone}

### BUSINESS DESCRIPTION & MISSION:
{biz_desc}

### OPERATING HOURS:
{hours_block}

### OFFICIAL CATALOGUE / SERVICES / PRODUCTS:
{items_block}

### ENABLED CAPABILITIES & WORKFLOWS:
{features_block}

### FIRST GREETING TO CALLER:
"{first_message}"

{BASE_CONVERSATION_RULES}

### TOOL USAGE POLICY:
- When a caller requests an action, use the attached router tools.
- Never guess an appointment or lead ID.
- Speak naturally and warmly in conversational English or Telugu as appropriate.
"""
    return prompt.strip()


def get_router_tools_for_business_type(business_type: str) -> List[Dict[str, Any]]:
    """Return attached tools based on business type (Phase 2C)."""
    b_type = (business_type or "").lower().replace(" ", "_")
    
    if "restaurant" in b_type:
        return [
            {"name": "get_menu", "description": "Retrieve full menu with categories and pricing"},
            {"name": "get_item", "description": "Retrieve detailed information for a specific menu item"},
            {"name": "get_hours", "description": "Check restaurant operating and kitchen hours"},
            {"name": "check_availability", "description": "Check table reservation availability for party size and time"},
            {"name": "create_reservation", "description": "Book a dining table reservation"},
            {"name": "modify_reservation", "description": "Modify an existing reservation date, time, or guest count"},
            {"name": "cancel_reservation", "description": "Cancel an existing dining reservation"},
        ]
    elif "loan" in b_type or "finance" in b_type:
        return [
            {"name": "get_loan_products", "description": "List available Personal, Business, and Used Car loan products"},
            {"name": "get_loan_product_details", "description": "Retrieve interest rates, tenure limits, and eligibility criteria"},
            {"name": "create_loan_application", "description": "Submit a new loan inquiry or pre-qualification application"},
            {"name": "update_personal_loan", "description": "Record salary, employer, and CIBIL details for personal loan"},
            {"name": "update_business_loan", "description": "Record turnover, GST, and business vintage for business loan"},
            {"name": "update_used_car_loan", "description": "Record vehicle make, model, valuation, and purchase details"},
            {"name": "create_callback", "description": "Schedule a telephone callback with a loan officer"},
            {"name": "save_call_outcome", "description": "Persist call qualification summary and disposition"},
        ]
    else:  # Service and Appointment Booking (default)
        return [
            {"name": "get_services", "description": "Retrieve list of all active services and consultation offerings"},
            {"name": "get_service_details", "description": "Retrieve detailed description, preparation, and duration for a service"},
            {"name": "get_pricing", "description": "Get transparent pricing breakdown for all bookable services"},
            {"name": "get_business_hours", "description": "Retrieve operating hours and availability windows for appointments"},
            {"name": "create_appointment", "description": "Schedule and confirm a new customer appointment"},
            {"name": "search_appointment", "description": "Search for existing appointment by reference ID, phone, or name"},
            {"name": "reschedule_appointment", "description": "Reschedule an appointment to a new date and time"},
            {"name": "cancel_appointment", "description": "Cancel an existing appointment with reason logging"},
        ]
