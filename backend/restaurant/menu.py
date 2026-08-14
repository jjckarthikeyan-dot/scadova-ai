import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client


# ---------------------------------------------------------
# LOAD ENVIRONMENT
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH)


# ---------------------------------------------------------
# ROUTER
# ---------------------------------------------------------

router = APIRouter()


# ---------------------------------------------------------
# SUPABASE
# ---------------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    raise RuntimeError(
        f"SUPABASE_URL is missing. Expected .env at: {ENV_PATH}"
    )

if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        f"SUPABASE_SERVICE_ROLE_KEY is missing. Expected .env at: {ENV_PATH}"
    )

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
)


# ---------------------------------------------------------
# RETELL REQUEST MODELS
# ---------------------------------------------------------

class MenuSearchArgs(BaseModel):
    business_id: str
    query: str | None = None
    category: str | None = None
    diet: str | None = None


class RetellMenuSearchRequest(BaseModel):
    name: str | None = None
    call: dict[str, Any] | None = None
    args: MenuSearchArgs


class MenuItemArgs(BaseModel):
    business_id: str
    item_name: str


class RetellMenuItemRequest(BaseModel):
    name: str | None = None
    call: dict[str, Any] | None = None
    args: MenuItemArgs


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def get_business(business_id: str):
    result = (
        supabase
        .table("businesses")
        .select(
            "id,"
            "business_key,"
            "business_type,"
            "name,"
            "spoken_name,"
            "timezone,"
            "active"
        )
        .eq("business_key", business_id)
        .eq("active", True)
        .limit(1)
        .execute()
    )

    businesses = result.data or []

    if not businesses:
        raise Exception(
            f"Business '{business_id}' was not found or is inactive."
        )

    business = businesses[0]

    if business.get("business_type") != "restaurant":
        raise Exception(
            f"Business '{business_id}' is not configured as a restaurant."
        )

    return business


def clean_diet_value(diet: str | None):
    if not diet:
        return None

    value = diet.strip().lower()

    mapping = {
        "veg": "vegetarian",
        "vegetarian": "vegetarian",

        "non veg": "non_vegetarian",
        "non-veg": "non_vegetarian",
        "nonveg": "non_vegetarian",
        "non_veg": "non_vegetarian",
        "non vegetarian": "non_vegetarian",
        "non_vegetarian": "non_vegetarian",

        "vegan": "vegan",

        "unknown": None,
        "any": None,
        "all": None
    }

    return mapping.get(value, value)


def format_menu_item(item: dict):
    return {
        "id": item.get("id"),
        "name": item.get("name"),
        "category": item.get("category"),
        "diet_type": item.get("diet_type"),
        "price": item.get("price"),
        "description": item.get("description"),
        "is_vegan": item.get("is_vegan"),
        "is_gluten_free": item.get("is_gluten_free"),
        "is_nut_free": item.get("is_nut_free"),
        "is_dairy_free": item.get("is_dairy_free"),
        "is_spicy": item.get("is_spicy"),
        "available": item.get("available")
    }


# ---------------------------------------------------------
# SEARCH MENU
# ---------------------------------------------------------

@router.post("/search")
def search_menu(payload: RetellMenuSearchRequest):
    try:
        request = payload.args

        business = get_business(request.business_id)

        db_query = (
            supabase
            .table("menu_items")
            .select(
                "id,"
                "name,"
                "category,"
                "diet_type,"
                "price,"
                "description,"
                "is_vegan,"
                "is_gluten_free,"
                "is_nut_free,"
                "is_dairy_free,"
                "is_spicy,"
                "available"
            )
            .eq("business_id", business["id"])
            .eq("available", True)
        )

        if request.category:
            category = request.category.strip()

            if category:
                db_query = db_query.ilike(
                    "category",
                    f"%{category}%"
                )

        diet = clean_diet_value(request.diet)

        if diet:
            db_query = db_query.eq(
                "diet_type",
                diet
            )

        if request.query:
            search_text = request.query.strip()

            if search_text:
                db_query = db_query.ilike(
                    "name",
                    f"%{search_text}%"
                )

        result = (
            db_query
            .order("category")
            .order("name")
            .limit(50)
            .execute()
        )

        items = [
            format_menu_item(item)
            for item in (result.data or [])
        ]

        if not items:
            return {
                "success": True,
                "found": False,
                "business_id": request.business_id,
                "business_name": business.get("name"),
                "count": 0,
                "message": "No matching menu items were found.",
                "items": []
            }

        return {
            "success": True,
            "found": True,
            "business_id": request.business_id,
            "business_name": business.get("name"),
            "count": len(items),
            "items": items
        }

    except Exception as e:
        print("SEARCH MENU ERROR:", str(e))

        return {
            "success": False,
            "found": False,
            "message": str(e),
            "items": []
        }


# ---------------------------------------------------------
# GET SPECIFIC MENU ITEM
# ---------------------------------------------------------

@router.post("/item")
def get_menu_item(payload: RetellMenuItemRequest):
    try:
        request = payload.args

        business = get_business(request.business_id)

        item_name = request.item_name.strip()

        if not item_name:
            return {
                "success": False,
                "found": False,
                "message": "item_name is required.",
                "items": []
            }

        result = (
            supabase
            .table("menu_items")
            .select(
                "id,"
                "name,"
                "category,"
                "diet_type,"
                "price,"
                "description,"
                "is_vegan,"
                "is_gluten_free,"
                "is_nut_free,"
                "is_dairy_free,"
                "is_spicy,"
                "available"
            )
            .eq("business_id", business["id"])
            .ilike(
                "name",
                f"%{item_name}%"
            )
            .order("name")
            .limit(10)
            .execute()
        )

        items = [
            format_menu_item(item)
            for item in (result.data or [])
        ]

        if not items:
            return {
                "success": True,
                "found": False,
                "business_id": request.business_id,
                "business_name": business.get("name"),
                "message": f"No menu item matching '{item_name}' was found.",
                "items": []
            }

        if len(items) == 1:
            return {
                "success": True,
                "found": True,
                "multiple_matches": False,
                "business_id": request.business_id,
                "business_name": business.get("name"),
                "item": items[0]
            }

        return {
            "success": True,
            "found": True,
            "multiple_matches": True,
            "business_id": request.business_id,
            "business_name": business.get("name"),
            "count": len(items),
            "items": items
        }

    except Exception as e:
        print("GET MENU ITEM ERROR:", str(e))

        return {
            "success": False,
            "found": False,
            "message": str(e),
            "items": []
        }


# ---------------------------------------------------------
# MENU CATEGORIES
# ---------------------------------------------------------

@router.get("/categories/{business_id}")
def get_menu_categories(business_id: str):
    try:
        business = get_business(business_id)

        result = (
            supabase
            .table("menu_items")
            .select("category")
            .eq("business_id", business["id"])
            .eq("available", True)
            .execute()
        )

        categories = sorted({
            row["category"]
            for row in (result.data or [])
            if row.get("category")
        })

        return {
            "success": True,
            "business_id": business_id,
            "business_name": business.get("name"),
            "count": len(categories),
            "categories": categories
        }

    except Exception as e:
        print("GET CATEGORIES ERROR:", str(e))

        return {
            "success": False,
            "business_id": business_id,
            "message": str(e),
            "categories": []
        }


# ---------------------------------------------------------
# HEALTH CHECK
# ---------------------------------------------------------

@router.get("/health")
def menu_health():
    return {
        "success": True,
        "module": "restaurant-menu",
        "status": "running"
    }