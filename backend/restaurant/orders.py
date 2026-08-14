import os
import uuid
from pathlib import Path
from datetime import date, time

from fastapi import APIRouter
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from supabase import create_client, Client


# ---------------------------------------------------------
# ENVIRONMENT
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is missing")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is missing")


supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
)


router = APIRouter()


# ---------------------------------------------------------
# MODELS
# ---------------------------------------------------------

class OrderItemRequest(BaseModel):
    item_name: str
    quantity: int = Field(default=1, ge=1, le=50)
    special_instructions: str | None = None


class CreateOrderRequest(BaseModel):
    business_id: str

    customer_name: str
    customer_phone: str | None = None

    pickup_date: date
    pickup_time: time

    items: list[OrderItemRequest]

    allergy_notes: str | None = None
    order_notes: str | None = None


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
            f"Business '{business_id}' is not a restaurant."
        )

    return business


def generate_order_number():
    short_id = uuid.uuid4().hex[:8].upper()
    return f"ORD-{short_id}"


def find_menu_item(business_db_id: int, item_name: str):
    """
    Finds a live available menu item.
    """

    result = (
        supabase
        .table("menu_items")
        .select(
            "id,"
            "name,"
            "price,"
            "category,"
            "diet_type,"
            "available"
        )
        .eq("business_id", business_db_id)
        .eq("available", True)
        .ilike("name", item_name.strip())
        .limit(1)
        .execute()
    )

    items = result.data or []

    if not items:
        return None

    return items[0]


# ---------------------------------------------------------
# CREATE ORDER
# ---------------------------------------------------------

@router.post("/create")
def create_order(request: CreateOrderRequest):

    created_order_id = None

    try:

        # -------------------------------------------------
        # 1. BUSINESS
        # -------------------------------------------------

        business = get_business(request.business_id)

        if not request.items:
            return {
                "success": False,
                "message": "The order must contain at least one item."
            }


        # -------------------------------------------------
        # 2. VALIDATE MENU ITEMS
        # -------------------------------------------------

        validated_items = []

        subtotal = 0.0

        for requested_item in request.items:

            menu_item = find_menu_item(
                business["id"],
                requested_item.item_name
            )

            if not menu_item:

                return {
                    "success": False,
                    "message": (
                        f"{requested_item.item_name} "
                        "is not currently available on the menu."
                    )
                }

            price = float(menu_item["price"])

            quantity = requested_item.quantity

            line_total = round(
                price * quantity,
                2
            )

            subtotal += line_total

            validated_items.append({
                "menu_item_id": menu_item["id"],
                "item_name": menu_item["name"],
                "quantity": quantity,
                "unit_price": price,
                "line_total": line_total,
                "special_instructions":
                    requested_item.special_instructions
            })


        subtotal = round(subtotal, 2)

        # For MVP:
        # total = subtotal
        #
        # Later POS can calculate tax, discounts,
        # service charges, etc.

        total = subtotal


        # -------------------------------------------------
        # 3. CREATE ORDER NUMBER
        # -------------------------------------------------

        order_number = generate_order_number()


        # -------------------------------------------------
        # 4. INSERT ORDER
        # -------------------------------------------------

        order_payload = {
            "business_id": business["id"],

            "order_number": order_number,

            "customer_name":
                request.customer_name.strip(),

            "customer_phone":
                request.customer_phone,

            "order_type": "pickup",

            "pickup_date":
                request.pickup_date.isoformat(),

            "pickup_time":
                request.pickup_time.isoformat(),

            "status": "confirmed",

            "subtotal": subtotal,
            "total": total,

            "allergy_notes":
                request.allergy_notes,

            "order_notes":
                request.order_notes
        }


        order_result = (
            supabase
            .table("orders")
            .insert(order_payload)
            .execute()
        )

        if not order_result.data:
            raise Exception(
                "Order could not be created."
            )


        order = order_result.data[0]

        created_order_id = order["id"]


        # -------------------------------------------------
        # 5. INSERT ORDER ITEMS
        # -------------------------------------------------

        order_item_rows = []

        for item in validated_items:

            order_item_rows.append({

                "order_id": created_order_id,

                "menu_item_id":
                    item["menu_item_id"],

                "item_name":
                    item["item_name"],

                "quantity":
                    item["quantity"],

                "unit_price":
                    item["unit_price"],

                "line_total":
                    item["line_total"],

                "special_instructions":
                    item["special_instructions"]
            })


        item_result = (
            supabase
            .table("order_items")
            .insert(order_item_rows)
            .execute()
        )

        if not item_result.data:
            raise Exception(
                "Order items could not be saved."
            )


        # -------------------------------------------------
        # 6. SUCCESS RESPONSE FOR RETELL
        # -------------------------------------------------

        return {
            "success": True,

            "order_confirmed": True,

            "business_id":
                request.business_id,

            "business_name":
                business["name"],

            "order_id":
                created_order_id,

            "order_number":
                order_number,

            "customer_name":
                request.customer_name,

            "pickup_date":
                request.pickup_date.isoformat(),

            "pickup_time":
                request.pickup_time.strftime("%I:%M %p"),

            "subtotal":
                subtotal,

            "total":
                total,

            "items":
                validated_items,

            "message": (
                f"Order {order_number} is confirmed "
                f"for pickup under {request.customer_name} "
                f"at {request.pickup_time.strftime('%I:%M %p')}. "
                f"The total is ${total:.2f}."
            )
        }


    except Exception as e:

        print(
            "CREATE ORDER ERROR:",
            str(e)
        )


        # Best-effort cleanup if order was inserted
        # but order_items failed.
        if created_order_id:

            try:

                supabase \
                    .table("orders") \
                    .delete() \
                    .eq(
                        "id",
                        created_order_id
                    ) \
                    .execute()

            except Exception as cleanup_error:

                print(
                    "ORDER CLEANUP ERROR:",
                    cleanup_error
                )


        return {
            "success": False,
            "order_confirmed": False,
            "message": str(e)
        }


# ---------------------------------------------------------
# GET ORDER
# ---------------------------------------------------------

@router.get("/{business_id}/{order_number}")
def get_order(
    business_id: str,
    order_number: str
):

    try:

        business = get_business(
            business_id
        )

        result = (
            supabase
            .table("orders")
            .select(
                "*"
            )
            .eq(
                "business_id",
                business["id"]
            )
            .eq(
                "order_number",
                order_number
            )
            .limit(1)
            .execute()
        )

        orders = result.data or []

        if not orders:

            return {
                "success": True,
                "found": False,
                "message":
                    "Order not found."
            }


        order = orders[0]


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
            "found": True,
            "order": order,
            "items":
                items_result.data or []
        }


    except Exception as e:

        return {
            "success": False,
            "found": False,
            "message": str(e)
        }


# ---------------------------------------------------------
# HEALTH
# ---------------------------------------------------------

@router.get("/health/check")
def orders_health():

    return {
        "success": True,
        "module":
            "restaurant-orders",
        "status":
            "running"
    }