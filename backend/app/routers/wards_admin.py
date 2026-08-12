"""
Wards and beds as data.

The 34 beds came from the seed and there was no way to open a ward, add
a bed, or take one out of service for cleaning or repair. A ward that
cannot take a bed offline overstates its capacity, which is the one
number the bed board exists to report.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import connection
from ..security import CurrentUser, require
from ..serialise import row

router = APIRouter(prefix="/wards", tags=["wards"])

Manager = Annotated[CurrentUser, Depends(require("nurse", "admin"))]


class NewWard(BaseModel):
    name: str = Field(min_length=2, max_length=60)


class NewBed(BaseModel):
    ward: str
    bedNo: str = Field(min_length=1, max_length=20)


class BedAvailability(BaseModel):
    isAvailable: bool
    reason: str | None = None


@router.post("/wards", status_code=201)
async def create_ward(body: NewWard, user: Manager):
    async with connection() as conn:
        await conn.execute(
            """insert into wards (name) values ($1)
               on conflict (name) do update set is_active = true""", body.name.strip())
        await conn.execute("select write_audit($1, 'Opened ward', $2)", user.id, body.name)
    return {"name": body.name.strip()}


@router.post("/beds", status_code=201)
async def create_bed(body: NewBed, user: Manager):
    async with connection() as conn:
        async with conn.transaction():
            known = await conn.fetchval(
                "select 1 from wards where name = $1 and is_active", body.ward)
            if not known:
                raise HTTPException(status_code=404, detail="No such ward.")
            try:
                record = await conn.fetchrow(
                    """insert into ward_beds (ward, bed_no) values ($1, $2) returning *""",
                    body.ward, body.bedNo.strip())
            except Exception as exc:
                raise HTTPException(
                    status_code=409,
                    detail=f"Bed {body.bedNo} already exists in {body.ward}.") from exc
            await conn.execute("select write_audit($1, 'Added bed', $2)", user.id,
                               f"{body.ward} {body.bedNo}")
    return row(record)


@router.patch("/beds/{ward}/{bed_no}", status_code=200)
async def set_availability(ward: str, bed_no: str, body: BedAvailability, user: Manager):
    """
    Taking a bed out of service. An occupied bed cannot be withdrawn:
    the patient in it has to go somewhere first, and pretending
    otherwise would lose them from the board.
    """
    async with connection() as conn:
        async with conn.transaction():
            occupied = await conn.fetchval(
                "select mrn from ward_beds where ward = $1 and bed_no = $2", ward, bed_no)
            if occupied and not body.isAvailable:
                raise HTTPException(
                    status_code=409,
                    detail="That bed is occupied. Discharge or transfer the patient first.")

            record = await conn.fetchrow(
                """update ward_beds
                      set is_available = $3, out_of_service_reason = $4
                    where ward = $1 and bed_no = $2 returning *""",
                ward, bed_no, body.isAvailable, None if body.isAvailable else body.reason)
            if record is None:
                raise HTTPException(status_code=404, detail="No such bed.")

            await conn.execute(
                "select write_audit($1, $2, $3)", user.id,
                'Returned bed to service' if body.isAvailable
                else f"Took bed out of service ({body.reason or 'no reason given'})",
                f"{ward} {bed_no}")
    return row(record)
