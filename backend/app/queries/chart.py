"""
The patient chart: all six tabs in one call, as the repository contract
requires.

What comes back depends on who is asking, and this is where three
row-level security policies now live instead:

  clinical   doctor, nurse, lab, radiology, pharmacist, admin — everything
  own        the patient themselves — their record, but ONLY verified
             laboratory results and ONLY reported imaging
  billing    receptionist, cashier — demographics and invoices, no
             clinical arrays at all

The `own` case matters most. "A laboratory result reaches nobody until
it is verified" was enforced by a policy before; here it is the WHERE
clause below, and test_authorisation.py checks it.
"""

from __future__ import annotations

from enum import Enum

import asyncpg

from ..serialise import row, rows


class View(str, Enum):
    CLINICAL = "clinical"
    OWN = "own"
    BILLING = "billing"


_ENCOUNTERS = """select e.*, s.full_name as doctor_name from encounters e
                 left join staff s on s.id = e.doctor_id
                 where e.mrn = $1 order by e.created_at desc"""
_VITALS = """select v.*, s.full_name as recorded_by_name from vitals v
             left join staff s on s.id = v.recorded_by
             where v.mrn = $1 order by v.recorded_at desc"""
_RX = """select r.*, s.full_name as prescriber_name from prescriptions r
         left join staff s on s.id = r.prescriber_id
         where r.mrn = $1 order by r.created_at desc"""
_DOCS = "select * from documents where mrn = $1 order by doc_date desc"
_BED = "select * from ward_beds where mrn = $1"
_INVOICES = "select * from invoices where mrn = $1 order by created_at desc"
_LINES = """select l.* from invoice_lines l join invoices i on i.id = l.invoice_id
            where i.mrn = $1 order by l.created_at"""

# The two that are filtered for a patient's own view.
_LABS_ALL = "select * from lab_orders where mrn = $1 order by created_at desc"
_LABS_RELEASED = """select * from lab_orders where mrn = $1 and status = 'verified'
                    order by created_at desc"""
_IMAGING_ALL = "select * from imaging_orders where mrn = $1 order by created_at desc"
_IMAGING_RELEASED = """select * from imaging_orders where mrn = $1 and status = 'reported'
                       order by created_at desc"""


async def _invoices(conn: asyncpg.Connection, mrn: str) -> list[dict]:
    invoices = rows(await conn.fetch(_INVOICES, mrn))
    lines = await conn.fetch(_LINES, mrn)
    by_invoice: dict[str, list[dict]] = {}
    for line in lines:
        by_invoice.setdefault(line["invoice_id"], []).append(row(line))
    for invoice in invoices:
        invoice["lines"] = by_invoice.get(invoice["id"], [])
    return invoices


async def full(conn: asyncpg.Connection, mrn: str, view: View) -> dict | None:
    patient = row(await conn.fetchrow("select * from patients where mrn = $1", mrn))
    if patient is None:
        return None

    bed = row(await conn.fetchrow(_BED, mrn))
    if bed:
        bed["patientName"] = patient["fullName"]

    chart: dict = {
        "patient": patient,
        "bed": bed,
        "invoices": await _invoices(conn, mrn),
        "encounters": [],
        "vitals": [],
        "labs": [],
        "imaging": [],
        "prescriptions": [],
        "documents": [],
    }

    if view is View.BILLING:
        return chart

    chart["encounters"] = rows(await conn.fetch(_ENCOUNTERS, mrn))
    chart["vitals"] = rows(await conn.fetch(_VITALS, mrn))
    chart["prescriptions"] = rows(await conn.fetch(_RX, mrn))
    chart["documents"] = rows(await conn.fetch(_DOCS, mrn))

    released_only = view is View.OWN
    chart["labs"] = rows(
        await conn.fetch(_LABS_RELEASED if released_only else _LABS_ALL, mrn)
    )
    chart["imaging"] = rows(
        await conn.fetch(_IMAGING_RELEASED if released_only else _IMAGING_ALL, mrn)
    )
    return chart
