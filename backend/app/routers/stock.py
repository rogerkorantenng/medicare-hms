"""
Inventory: creating items, receiving deliveries, and adjusting counts.

Stock could only ever fall, because dispensing was the only thing that
wrote to a quantity. A pharmacy that cannot record a delivery empties
itself and stays empty, which is what happened to the demonstration data
after the test suite had run a few times.

Every change goes through move_stock(), which updates the quantity and
writes the movement that explains it in one transaction. A count nobody
can account for is not a count.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import connection
from ..security import CurrentUser, require
from ..serialise import row, rows

router = APIRouter(prefix="/pharmacy", tags=["pharmacy"])

Pharmacist = Annotated[CurrentUser, Depends(require("pharmacist", "admin"))]
Reader = Annotated[CurrentUser, Depends(require("pharmacist", "doctor", "nurse", "admin"))]


class NewItem(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: str | None = None
    quantity: int = Field(ge=0, default=0)
    reorderLevel: int = Field(ge=0, default=10)
    unitPrice: float = Field(ge=0)
    expiryDate: str | None = None


class ItemPatch(BaseModel):
    category: str | None = None
    reorderLevel: int | None = Field(default=None, ge=0)
    unitPrice: float | None = Field(default=None, ge=0)
    expiryDate: str | None = None


class Movement(BaseModel):
    quantity: int = Field(description="Positive to receive, negative to write off")
    reason: str = Field(min_length=3, max_length=200)


@router.post("/inventory", status_code=201)
async def create_item(body: NewItem, user: Pharmacist):
    """Opening stock is recorded as a movement, so the ledger starts clean."""
    async with connection() as conn:
        async with conn.transaction():
            record = await conn.fetchrow(
                """insert into inventory_items
                     (name, category, quantity, reorder_level, unit_price, expiry_date)
                   values ($1, $2, $3, $4, $5, $6::date) returning *""",
                body.name.strip(), body.category, body.quantity,
                body.reorderLevel, body.unitPrice, body.expiryDate)
            if body.quantity:
                await conn.execute(
                    "insert into stock_movements (item_id, kind, quantity, reason, moved_by)"
                    " values ($1, 'received', $2, 'Opening stock', $3)",
                    record["id"], body.quantity, user.id)
            await conn.execute("select write_audit($1, 'Added inventory item', $2)",
                               user.id, body.name)
    return row(record)


@router.patch("/inventory/{item_id}", status_code=200)
async def update_item(item_id: int, body: ItemPatch, user: Pharmacist):
    """
    Everything except the quantity, which only ever moves through
    move_stock so that a movement row always explains it.
    """
    fields = body.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nothing to change.")

    columns = {"category": "category", "reorderLevel": "reorder_level",
               "unitPrice": "unit_price", "expiryDate": "expiry_date"}
    casts = {"expiryDate": "::date"}
    sets = ", ".join(f"{columns[k]} = ${i + 2}{casts.get(k, '')}"
                     for i, k in enumerate(fields))

    async with connection() as conn:
        async with conn.transaction():
            record = await conn.fetchrow(
                f"update inventory_items set {sets} where id = $1 returning *",
                item_id, *fields.values())
            if record is None:
                raise HTTPException(status_code=404, detail="No such item.")
            await conn.execute("select write_audit($1, 'Updated inventory item', $2)",
                               user.id, record["name"])
    return row(record)


@router.post("/inventory/{item_id}/movement", status_code=200)
async def move(item_id: int, body: Movement, user: Pharmacist):
    """A delivery, a write-off, or a recount. The reason is required."""
    kind = "received" if body.quantity > 0 else "adjusted"
    async with connection() as conn:
        new_quantity = await conn.fetchval(
            "select move_stock($1, $2, $3, $4, $5)",
            user.id, item_id, kind, body.quantity, body.reason)
    return {"quantity": new_quantity}


@router.get("/inventory/{item_id}/movements")
async def movements(item_id: int, user: Reader):
    """The ledger behind a quantity, newest first."""
    async with connection() as conn:
        return rows(await conn.fetch(
            """select m.*, s.full_name as moved_by_name
                 from stock_movements m
                 left join staff s on s.id = m.moved_by
                where m.item_id = $1 order by m.moved_at desc limit 100""",
            item_id))
