"""
Billing corrections, and raising a claim.

Money moved in one direction only: a payment could be taken and nothing
could be given back, so an overpayment or a mistaken entry was permanent.
Claims existed only because the seed created three, so a cashier looking
at an insured invoice had no way to submit one.

Every movement writes a payments row, including refunds, which are
negative. The ledger then sums to the balance instead of asserting it.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import connection
from ..security import CurrentUser, require
from ..serialise import row, rows

router = APIRouter(tags=["billing"])

Cashier = Annotated[CurrentUser, Depends(require("cashier", "admin"))]


class Refund(BaseModel):
    amount: float = Field(gt=0)
    reason: str = Field(min_length=3, max_length=200)


class WriteOff(BaseModel):
    amount: float = Field(gt=0)
    reason: str = Field(min_length=3, max_length=200)


class ManualLine(BaseModel):
    description: str = Field(min_length=2, max_length=120)
    amount: float = Field(gt=0)


class NewClaim(BaseModel):
    invoiceId: str
    insurer: str = Field(min_length=2, max_length=80)
    amount: float = Field(gt=0)


class Rejection(BaseModel):
    reason: str = Field(min_length=3, max_length=200)


@router.post("/invoices/{invoice_id}/refund", status_code=204)
async def refund(invoice_id: str, body: Refund, user: Cashier):
    """Recorded as a negative payment, so the ledger still adds up."""
    async with connection() as conn:
        await conn.execute("select record_money($1, $2, $3, 'refund', null, $4)",
                           user.id, invoice_id, -body.amount, body.reason)


@router.post("/invoices/{invoice_id}/write-off", status_code=204)
async def write_off(invoice_id: str, body: WriteOff, user: Cashier):
    """
    Closes a balance that will not be collected. Kept separate from a
    payment because the money never arrived, and a hospital counting
    revenue must not confuse the two.
    """
    async with connection() as conn:
        await conn.execute("select write_off_invoice($1, $2, $3, $4)",
                           user.id, invoice_id, body.amount, body.reason)


@router.post("/invoices/{invoice_id}/line", status_code=201)
async def add_line(invoice_id: str, body: ManualLine, user: Cashier):
    """A dressing, a consumable, a bed-day: charges with no clinical event."""
    async with connection() as conn:
        async with conn.transaction():
            owner = await conn.fetchval("select mrn from invoices where id = $1", invoice_id)
            if owner is None:
                raise HTTPException(status_code=404, detail="No such invoice.")
            await conn.execute("select add_invoice_line($1, $2, $3)",
                               owner, body.description, body.amount)
            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               f"Added charge {body.description}", invoice_id)
    return {"invoiceId": invoice_id, "description": body.description, "amount": body.amount}


@router.get("/invoices/{invoice_id}/payments")
async def payment_history(invoice_id: str, user: Cashier):
    async with connection() as conn:
        return rows(await conn.fetch(
            """select p.*, s.full_name as taken_by_name from payments p
                 left join staff s on s.id = p.taken_by
                where p.invoice_id = $1 order by p.taken_at desc""", invoice_id))


@router.post("/claims", status_code=201)
async def raise_claim(body: NewClaim, user: Cashier):
    """
    Claim numbers are allocated here so two cashiers cannot collide,
    the same way the MRN and the staff number are.
    """
    async with connection() as conn:
        async with conn.transaction():
            invoice = await conn.fetchrow(
                "select mrn, total from invoices where id = $1", body.invoiceId)
            if invoice is None:
                raise HTTPException(status_code=404, detail="No such invoice.")
            if body.amount > float(invoice["total"]):
                raise HTTPException(
                    status_code=422,
                    detail="A claim cannot exceed the invoice total.")

            claim_id = await conn.fetchval(
                """select 'CLM-' || (coalesce(max(nullif(
                          regexp_replace(id, '\\D', '', 'g'), '')::int), 0) + 1)::text
                     from claims""")
            record = await conn.fetchrow(
                """insert into claims (id, invoice_id, insurer, amount)
                   values ($1, $2, $3, $4) returning *""",
                claim_id, body.invoiceId, body.insurer, body.amount)
            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               f"Raised claim {claim_id} with {body.insurer}", invoice["mrn"])
    return row(record)


@router.post("/claims/{claim_id}/reject", status_code=204)
async def reject_claim(claim_id: str, body: Rejection, user: Cashier):
    """
    Insurers refuse claims, and the status only ever moved forward. The
    claim keeps its place in the ledger with the reason attached.
    """
    async with connection() as conn:
        async with conn.transaction():
            claim = await conn.fetchrow(
                """update claims set rejected_reason = $2 where id = $1 and status <> 'paid'
                   returning invoice_id, insurer""", claim_id, body.reason)
            if claim is None:
                raise HTTPException(
                    status_code=409, detail="That claim is paid and cannot be rejected.")
            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               f"Claim {claim_id} rejected by {claim['insurer']}"
                               f" ({body.reason})", claim["invoice_id"])
