from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..db import connection
from ..security import BILLING_ROLES, CurrentUser, require
from ..serialise import row, rows

router = APIRouter(tags=["billing"])

Cashier = Annotated[CurrentUser, Depends(require("cashier", "admin"))]
Billing = Annotated[CurrentUser, Depends(require(*BILLING_ROLES))]

_INVOICES = """select i.*, p.full_name as patient_name
                 from invoices i join patients p on p.mrn = i.mrn
                where ($1::text is null or i.status::text = $1)
                  and ($2::text is null or i.mrn = $2)
                order by i.created_at desc
                limit $3 offset $4"""
_LINES = "select * from invoice_lines order by created_at"


class Payment(BaseModel):
    amount: float = Field(gt=0)
    method: Literal["cash", "momo"]
    provider: str | None = None


@router.get("/invoices")
async def invoices(user: Billing, status: str | None = None, mrn: str | None = None,
                   limit: int = 100, offset: int = 0):
    """Status is a generated column — derived from total and paid, never stored."""
    async with connection() as conn:
        found = rows(await conn.fetch(_INVOICES, status, mrn,
                                      min(limit, 500), offset))
        lines = await conn.fetch(_LINES)
    by_invoice: dict[str, list[dict]] = {}
    for line in lines:
        by_invoice.setdefault(line["invoice_id"], []).append(row(line))
    for invoice in found:
        invoice["lines"] = by_invoice.get(invoice["id"], [])
    return found


@router.post("/invoices/{invoice_id}/payment", status_code=204)
async def record_payment(invoice_id: str, body: Payment, user: Cashier):
    """The audit entry names the provider: Payment recorded (MoMo · MTN MoMo) INV-2100."""
    async with connection() as conn:
        await conn.execute("select record_payment($1,$2,$3,$4,$5)",
                           user.id, invoice_id, body.amount, body.method, body.provider)


@router.get("/claims")
async def claims(user: Cashier):
    async with connection() as conn:
        return rows(await conn.fetch("select * from claims order by updated_at desc"))


@router.post("/claims/{claim_id}/advance", status_code=204)
async def advance_claim(claim_id: str, user: Cashier):
    """Forward only. The trigger refuses anything else."""
    async with connection() as conn:
        await conn.execute("select advance_claim($1,$2)", user.id, claim_id)


@router.patch("/claims/{claim_id}/justification", status_code=204)
async def set_justification(claim_id: str, user: Cashier, text: str):
    async with connection() as conn:
        await conn.execute("update claims set justification = $2 where id = $1",
                           claim_id, text)
