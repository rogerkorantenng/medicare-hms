"""
The three printable documents: prescription slip, receipt, discharge summary.

Each is fetched, then scoped. The order matters — the row is read first so
its MRN is known, and `scope_to_patient` then refuses a patient asking for
somebody else's with the same 403 it gives any other role violation, so the
API never reveals whether that document exists.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from ..db import connection
from ..security import BILLING_ROLES, CLINICAL_ROLES, CurrentUser, require, scope_to_patient
from ..serialise import row, rows

router = APIRouter(prefix="/documents", tags=["documents"])

Clinical = Annotated[CurrentUser, Depends(require(*(CLINICAL_ROLES | {"patient"})))]
Billing = Annotated[CurrentUser, Depends(require(*(BILLING_ROLES | {"patient"})))]

_MISSING = HTTPException(status_code=404, detail="No such document.")


@router.get("/prescription/{rx_id}")
async def prescription_slip(rx_id: int, user: Clinical):
    async with connection() as conn:
        record = await conn.fetchrow(
            """select r.*, p.full_name as patient_name, p.age, p.sex, p.allergies,
                      s.full_name as prescriber_name, s.staff_no, s.department
                 from prescriptions r
                 join patients p on p.mrn = r.mrn
                 join staff s on s.id = r.prescriber_id
                where r.id = $1""",
            rx_id,
        )
    if record is None:
        raise _MISSING
    scope_to_patient(user, record["mrn"])
    return row(record)


@router.get("/receipt/{invoice_id}")
async def receipt(invoice_id: str, user: Billing):
    async with connection() as conn:
        invoice = await conn.fetchrow(
            """select i.*, p.full_name as patient_name
                 from invoices i join patients p on p.mrn = i.mrn
                where i.id = $1""",
            invoice_id,
        )
        if invoice is None:
            raise _MISSING
        scope_to_patient(user, invoice["mrn"])
        lines = await conn.fetch(
            """select id, description, amount from invoice_lines
                where invoice_id = $1 order by id""",
            invoice_id,
        )
    return row(invoice, lines=rows(lines))


@router.get("/discharge/{doc_id}")
async def discharge_summary(doc_id: int, user: Clinical):
    """
    Rendered from the stored document rather than reconstructed, so what is
    printed is exactly what discharge_patient() wrote when the bed was freed.
    """
    async with connection() as conn:
        record = await conn.fetchrow(
            """select d.*, p.full_name as patient_name, p.age, p.sex
                 from documents d join patients p on p.mrn = d.mrn
                where d.id = $1""",
            doc_id,
        )
    if record is None:
        raise _MISSING
    scope_to_patient(user, record["mrn"])
    return row(record)
