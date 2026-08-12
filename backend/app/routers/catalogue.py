"""
Reference data: laboratory tests, imaging studies, the tariff, and
departments.

All of it used to live in TypeScript arrays, so repricing a test meant a
code change and a redeploy. A hospital reprices far more often than it
redeploys, and the person who sets a price is not the person who can
deploy.

Reading is open to any signed-in user, because the consultation screen
needs the list to order from. Changing it is administrative.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..db import connection
from ..security import CurrentUser, require
from ..serialise import row, rows

router = APIRouter(prefix="/catalogue", tags=["catalogue"])

Admin = Annotated[CurrentUser, Depends(require("admin"))]
AnyUser = Annotated[CurrentUser, Depends(require())]

KINDS = {"lab", "imaging", "tariff"}


class NewEntry(BaseModel):
    kind: str
    name: str = Field(min_length=2, max_length=120)
    bodyRegion: str | None = None
    price: float = Field(ge=0)


class EntryPatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    bodyRegion: str | None = None
    price: float | None = Field(default=None, ge=0)
    isActive: bool | None = None


def _check(kind: str) -> None:
    if kind not in KINDS:
        raise HTTPException(status_code=422,
                            detail=f"Kind must be one of {', '.join(sorted(KINDS))}.")


@router.get("")
async def list_entries(user: AnyUser, kind: str | None = Query(None),
                       include_inactive: bool = False):
    async with connection() as conn:
        return rows(await conn.fetch(
            """select * from catalogue_items
                where ($1::text is null or kind = $1)
                  and ($2 or is_active)
                order by kind, name, body_region""",
            kind, include_inactive))


@router.post("", status_code=201)
async def create_entry(body: NewEntry, user: Admin):
    _check(body.kind)
    async with connection() as conn:
        async with conn.transaction():
            record = await conn.fetchrow(
                """insert into catalogue_items (kind, name, body_region, price)
                   values ($1, $2, $3, $4) returning *""",
                body.kind, body.name.strip(), body.bodyRegion, body.price)
            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               f"Added {body.kind} catalogue entry", body.name)
    return row(record)


@router.patch("/{entry_id}", status_code=200)
async def update_entry(entry_id: int, body: EntryPatch, user: Admin):
    """
    Retiring an entry sets is_active false rather than deleting it. Past
    orders and invoice lines name what was ordered, and a price that
    changes must not rewrite what somebody was already charged.
    """
    fields = body.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nothing to change.")

    columns = {"name": "name", "bodyRegion": "body_region",
               "price": "price", "isActive": "is_active"}
    sets = ", ".join(f"{columns[k]} = ${i + 2}" for i, k in enumerate(fields))

    async with connection() as conn:
        async with conn.transaction():
            record = await conn.fetchrow(
                f"update catalogue_items set {sets} where id = $1 returning *",
                entry_id, *fields.values())
            if record is None:
                raise HTTPException(status_code=404, detail="No such entry.")
            await conn.execute("select write_audit($1, 'Updated catalogue entry', $2)",
                               user.id, record["name"])
    return row(record)


@router.get("/departments")
async def list_departments(user: AnyUser):
    async with connection() as conn:
        return [r["name"] for r in await conn.fetch(
            "select name from departments where is_active order by name")]


@router.post("/departments", status_code=201)
async def add_department(user: Admin, name: str = Query(min_length=2)):
    async with connection() as conn:
        await conn.execute(
            """insert into departments (name) values ($1)
               on conflict (name) do update set is_active = true""", name.strip())
        await conn.execute("select write_audit($1, 'Added department', $2)", user.id, name)
    return {"name": name.strip()}
