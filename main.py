import os
from datetime import date, time
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from supabase import Client, create_client


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
RESTAURANT_SLUG = os.getenv(
    "RESTAURANT_SLUG",
    "bawarchi-birmingham"
)

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is missing from .env")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        "SUPABASE_SERVICE_ROLE_KEY is missing from .env"
    )


# ============================================================
# SUPABASE
# ============================================================

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
)


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="Restaurant AI Brain",
    description="FastAPI backend for Retell Restaurant Voice Agent",
    version="1.0.0"
)


# ============================================================
# HELPERS
# ============================================================

def money(value) -> Decimal:
    """
    Safely convert database / numeric values to Decimal.
    """
    return Decimal(str(value or 0)).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP
    )


def get_restaurant():
    """
    Get the current restaurant configuration.
    """

    result = (
        supabase
        .table("restaurants")
        .select(
            "id,name,spoken_name,slug,"
            "restaurant_type,phone,address,"
            "city,state,zip_code,timezone,active"
        )
        .eq("slug", RESTAURANT_SLUG)
        .eq("active", True)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=404,
            detail="Restaurant not found or inactive."
        )

    return result.data[0]


# ============================================================
# REQUEST MODELS
# ============================================================

class MenuSearchRequest(BaseModel):
    query: Optional[str] = None
    category: Optional[str] = None

    diet: Optional[str] = Field(
        default=None,
        description=(
            "vegetarian, non_vegetarian, vegan, or unknown"
        )
    )


class SelectedOptionRequest(BaseModel):
    option_id: int


class OrderItemRequest(BaseModel):
    menu_item_id: int

    quantity: int = Field(
        ge=1,
        le=100
    )

    selected_options: List[SelectedOptionRequest] = []

    special_instructions: Optional[str] = None


class CreateOrderRequest(BaseModel):
    customer_name: str

    customer_phone: Optional[str] = None

    pickup_date: date

    pickup_time: time

    allergy_notes: Optional[str] = None

    special_instructions: Optional[str] = None

    items: List[OrderItemRequest]


# ============================================================
# HEALTH
# ============================================================

@app.get("/")
def home():

    restaurant = get_restaurant()

    return {
        "success": True,
        "status": "Restaurant AI Brain is running",
        "restaurant": restaurant["name"],
        "spoken_name": restaurant.get("spoken_name")
    }


@app.get("/health")
def health():

    return {
        "success": True,
        "status": "healthy"
    }


# ============================================================
# RESTAURANT INFO
# ============================================================

@app.get("/api/restaurant")
def restaurant_info():

    restaurant = get_restaurant()

    return {
        "success": True,
        "restaurant": restaurant
    }


# ============================================================
# MENU SEARCH
# ============================================================

@app.post("/api/menu/search")
def search_menu(request: MenuSearchRequest):

    restaurant = get_restaurant()

    query = (
        supabase
        .table("menu_items")
        .select(
            "id,"
            "name,"
            "category,"
            "diet_type,"
            "price,"
            "short_description,"
            "available"
        )
        .eq(
            "restaurant_id",
            restaurant["id"]
        )
        .eq(
            "available",
            True
        )
    )

    # --------------------------------------------------------
    # CATEGORY
    # --------------------------------------------------------

    if request.category:

        query = query.ilike(
            "category",
            f"%{request.category.strip()}%"
        )

    # --------------------------------------------------------
    # DIET
    # --------------------------------------------------------

    if request.diet:

        normalized_diet = request.diet.strip().lower()

        if normalized_diet not in {
            "unknown",
            "any",
            "all"
        }:

            query = query.eq(
                "diet_type",
                normalized_diet
            )

    # --------------------------------------------------------
    # SEARCH TEXT
    # --------------------------------------------------------

    if request.query:

        query = query.ilike(
            "name",
            f"%{request.query.strip()}%"
        )

    result = (
        query
        .order("category")
        .order("name")
        .limit(25)
        .execute()
    )

    if not result.data:

        return {
            "success": True,
            "found": False,
            "count": 0,
            "message": (
                "No matching menu items were found."
            ),
            "items": []
        }

    return {
        "success": True,
        "found": True,
        "count": len(result.data),
        "items": result.data
    }


# ============================================================
# GET MENU ITEM + CUSTOMIZATIONS
# ============================================================

@app.get("/api/menu/item/{item_id}")
def get_menu_item(item_id: int):

    restaurant = get_restaurant()

    # --------------------------------------------------------
    # ITEM
    # --------------------------------------------------------

    item_result = (
        supabase
        .table("menu_items")
        .select(
            "id,"
            "name,"
            "category,"
            "diet_type,"
            "price,"
            "description,"
            "short_description,"
            "full_description,"
            "spice_supported,"
            "is_vegan,"
            "is_gluten_free,"
            "is_nut_free,"
            "is_dairy_free,"
            "is_spicy,"
            "preparation_time_minutes,"
            "available"
        )
        .eq(
            "id",
            item_id
        )
        .eq(
            "restaurant_id",
            restaurant["id"]
        )
        .execute()
    )

    if not item_result.data:

        raise HTTPException(
            status_code=404,
            detail="Menu item not found."
        )

    item = item_result.data[0]

    # --------------------------------------------------------
    # OPTION GROUPS
    # --------------------------------------------------------

    group_result = (
        supabase
        .table("menu_item_option_groups")
        .select(
            "id,"
            "name,"
            "description,"
            "required,"
            "min_select,"
            "max_select,"
            "sort_order"
        )
        .eq(
            "menu_item_id",
            item_id
        )
        .eq(
            "active",
            True
        )
        .order(
            "sort_order"
        )
        .execute()
    )

    customization_groups = []

    # --------------------------------------------------------
    # OPTIONS
    # --------------------------------------------------------

    for group in group_result.data or []:

        option_result = (
            supabase
            .table("menu_item_options")
            .select(
                "id,"
                "name,"
                "description,"
                "price_adjustment,"
                "available,"
                "sort_order"
            )
            .eq(
                "option_group_id",
                group["id"]
            )
            .eq(
                "available",
                True
            )
            .order(
                "sort_order"
            )
            .execute()
        )

        customization_groups.append({

            "group_id": group["id"],

            "group_name": group["name"],

            "description": group.get(
                "description"
            ),

            "required": group["required"],

            "min_select": group[
                "min_select"
            ],

            "max_select": group[
                "max_select"
            ],

            "options": option_result.data or []
        })

    return {

        "success": True,

        "item": item,

        "customizations": customization_groups
    }


# ============================================================
# DAILY SPECIALS
# ============================================================

@app.get("/api/specials")
def get_daily_specials():

    restaurant = get_restaurant()

    today = date.today()

    daily_result = (
        supabase
        .table("daily_specials")
        .select(
            "id,"
            "item_name,"
            "description,"
            "price,"
            "diet_type,"
            "available"
        )
        .eq(
            "restaurant_id",
            restaurant["id"]
        )
        .eq(
            "special_date",
            str(today)
        )
        .eq(
            "available",
            True
        )
        .execute()
    )

    # --------------------------------------------------------
    # Daily specials override weekly specials
    # --------------------------------------------------------

    if daily_result.data:

        return {

            "success": True,

            "special_type": "daily",

            "date": str(today),

            "items": daily_result.data
        }

    # Python weekday:
    # Monday = 0
    # Supabase weekly_specials:
    # Monday = 1
    weekday = today.weekday() + 1

    weekly_result = (
        supabase
        .table("weekly_specials")
        .select(
            "id,"
            "weekday,"
            "item_name,"
            "price,"
            "active"
        )
        .eq(
            "restaurant_id",
            restaurant["id"]
        )
        .eq(
            "weekday",
            weekday
        )
        .eq(
            "active",
            True
        )
        .execute()
    )

    return {

        "success": True,

        "special_type": "weekly",

        "date": str(today),

        "items": weekly_result.data or []
    }


# ============================================================
# CREATE ORDER
# ============================================================

@app.post("/api/orders")
def create_order(request: CreateOrderRequest):

    restaurant = get_restaurant()

    # --------------------------------------------------------
    # BASIC VALIDATION
    # --------------------------------------------------------

    if not request.items:

        raise HTTPException(
            status_code=400,
            detail="Order must contain at least one item."
        )

    final_items = []

    order_subtotal = Decimal("0.00")

    # ========================================================
    # PROCESS EACH ITEM
    # ========================================================

    for requested_item in request.items:

        # ----------------------------------------------------
        # GET MENU ITEM
        # ----------------------------------------------------

        menu_result = (
            supabase
            .table("menu_items")
            .select(
                "id,"
                "name,"
                "price,"
                "available"
            )
            .eq(
                "id",
                requested_item.menu_item_id
            )
            .eq(
                "restaurant_id",
                restaurant["id"]
            )
            .execute()
        )

        if not menu_result.data:

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Menu item "
                    f"{requested_item.menu_item_id} "
                    f"was not found."
                )
            )

        menu_item = menu_result.data[0]

        if not menu_item["available"]:

            raise HTTPException(
                status_code=400,
                detail=(
                    f"{menu_item['name']} "
                    f"is currently unavailable."
                )
            )

        base_price = money(
            menu_item["price"]
        )

        # ----------------------------------------------------
        # GET CUSTOMIZATION GROUPS
        # ----------------------------------------------------

        groups_result = (
            supabase
            .table(
                "menu_item_option_groups"
            )
            .select(
                "id,"
                "name,"
                "required,"
                "min_select,"
                "max_select"
            )
            .eq(
                "menu_item_id",
                requested_item.menu_item_id
            )
            .eq(
                "active",
                True
            )
            .execute()
        )

        groups = groups_result.data or []

        groups_by_id = {
            group["id"]: group
            for group in groups
        }

        # ----------------------------------------------------
        # GET ALL AVAILABLE OPTIONS
        # ----------------------------------------------------

        available_options = {}

        for group in groups:

            options_result = (
                supabase
                .table(
                    "menu_item_options"
                )
                .select(
                    "id,"
                    "option_group_id,"
                    "name,"
                    "price_adjustment,"
                    "available"
                )
                .eq(
                    "option_group_id",
                    group["id"]
                )
                .eq(
                    "available",
                    True
                )
                .execute()
            )

            for option in options_result.data or []:

                available_options[
                    option["id"]
                ] = option

        # ----------------------------------------------------
        # VALIDATE SELECTED OPTIONS
        # ----------------------------------------------------

        selected_options = []

        selected_count_by_group = {}

        selected_option_ids = set()

        options_total = Decimal("0.00")

        for selected in requested_item.selected_options:

            if selected.option_id in selected_option_ids:

                continue

            selected_option_ids.add(
                selected.option_id
            )

            if selected.option_id not in available_options:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Option {selected.option_id} "
                        f"is invalid or unavailable "
                        f"for {menu_item['name']}."
                    )
                )

            option = available_options[
                selected.option_id
            ]

            group_id = option[
                "option_group_id"
            ]

            group = groups_by_id[
                group_id
            ]

            adjustment = money(
                option.get(
                    "price_adjustment",
                    0
                )
            )

            options_total += adjustment

            selected_count_by_group[
                group_id
            ] = (
                selected_count_by_group.get(
                    group_id,
                    0
                )
                + 1
            )

            selected_options.append({

                "group_id": group_id,

                "group_name": group[
                    "name"
                ],

                "option_id": option["id"],

                "option_name": option[
                    "name"
                ],

                "price_adjustment": float(
                    adjustment
                )
            })

        # ----------------------------------------------------
        # REQUIRED GROUP VALIDATION
        # ----------------------------------------------------

        for group in groups:

            selected_count = (
                selected_count_by_group.get(
                    group["id"],
                    0
                )
            )

            minimum = (
                group["min_select"]
                if group["min_select"]
                is not None
                else 0
            )

            maximum = (
                group["max_select"]
                if group["max_select"]
                is not None
                else 999
            )

            if group["required"]:

                minimum = max(
                    minimum,
                    1
                )

            if selected_count < minimum:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"{menu_item['name']} "
                        f"requires a selection for "
                        f"'{group['name']}'."
                    )
                )

            if selected_count > maximum:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Too many selections for "
                        f"'{group['name']}' on "
                        f"{menu_item['name']}."
                    )
                )

        # ----------------------------------------------------
        # PRICE
        # ----------------------------------------------------

        quantity = requested_item.quantity

        single_item_price = (
            base_price
            + options_total
        )

        line_total = (
            single_item_price
            * quantity
        ).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP
        )

        order_subtotal += line_total

        final_items.append({

            "menu_item_id": menu_item[
                "id"
            ],

            "item_name": menu_item[
                "name"
            ],

            "quantity": quantity,

            "base_price": float(
                base_price
            ),

            "options_total": float(
                options_total
            ),

            "unit_price": float(
                single_item_price
            ),

            "line_total": float(
                line_total
            ),

            "selected_options": (
                selected_options
            ),

            "special_instructions": (
                requested_item
                .special_instructions
            )
        })

    # ========================================================
    # ORDER TOTALS
    # ========================================================

    order_subtotal = (
        order_subtotal
        .quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP
        )
    )

    # --------------------------------------------------------
    # TAX
    #
    # Keep zero until we add restaurant-specific tax
    # configuration.
    # --------------------------------------------------------

    tax = Decimal("0.00")

    total = (
        order_subtotal
        + tax
    ).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP
    )

    # ========================================================
    # CREATE ORDER NUMBER
    # ========================================================

    order_number = (
        "BW-"
        + uuid4().hex[:8].upper()
    )

    # ========================================================
    # INSERT ORDER
    # ========================================================

    order_result = (
        supabase
        .table("orders")
        .insert({

            "restaurant_id": restaurant[
                "id"
            ],

            "order_number": order_number,

            "customer_name": (
                request.customer_name
            ),

            "customer_phone": (
                request.customer_phone
            ),

            "pickup_date": str(
                request.pickup_date
            ),

            "pickup_time": str(
                request.pickup_time
            ),

            "status": "confirmed",

            "subtotal": float(
                order_subtotal
            ),

            "tax": float(
                tax
            ),

            "total": float(
                total
            ),

            "allergy_notes": (
                request.allergy_notes
            ),

            "special_instructions": (
                request
                .special_instructions
            )
        })
        .execute()
    )

    if not order_result.data:

        raise HTTPException(
            status_code=500,
            detail="Order could not be created."
        )

    order = order_result.data[0]

    order_id = order["id"]

    # ========================================================
    # INSERT ORDER ITEMS
    # ========================================================

    order_item_rows = []

    for item in final_items:

        order_item_rows.append({

            "order_id": order_id,

            "menu_item_id": item[
                "menu_item_id"
            ],

            "item_name": item[
                "item_name"
            ],

            "quantity": item[
                "quantity"
            ],

            "base_price": item[
                "base_price"
            ],

            "options_total": item[
                "options_total"
            ],

            "unit_price": item[
                "unit_price"
            ],

            "line_total": item[
                "line_total"
            ],

            "selected_options": item[
                "selected_options"
            ],

            "special_instructions": item[
                "special_instructions"
            ]
        })

    (
        supabase
        .table("order_items")
        .insert(order_item_rows)
        .execute()
    )

    # ========================================================
    # FINAL RESPONSE TO RETELL
    # ========================================================

    return {

        "success": True,

        "message": (
            "Pickup order successfully created."
        ),

        "order_id": order_id,

        "order_number": order_number,

        "status": "confirmed",

        "customer_name": request.customer_name,

        "pickup_date": str(
            request.pickup_date
        ),

        "pickup_time": str(
            request.pickup_time
        ),

        "subtotal": float(
            order_subtotal
        ),

        "tax": float(
            tax
        ),

        "total": float(
            total
        ),

        "items": final_items
    }


# ============================================================
# GET ORDER
# ============================================================

@app.get("/api/orders/{order_number}")
def get_order(order_number: str):

    restaurant = get_restaurant()

    order_result = (
        supabase
        .table("orders")
        .select("*")
        .eq(
            "restaurant_id",
            restaurant["id"]
        )
        .eq(
            "order_number",
            order_number
        )
        .execute()
    )

    if not order_result.data:

        raise HTTPException(
            status_code=404,
            detail="Order not found."
        )

    order = order_result.data[0]

    items_result = (
        supabase
        .table("order_items")
        .select("*")
        .eq(
            "order_id",
            order["id"]
        )
        .execute()
    )

    return {

        "success": True,

        "order": order,

        "items": items_result.data or []
    }