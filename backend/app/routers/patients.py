from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..db import connection
from ..queries import chart as chart_q
from ..queries import patients as q
from ..security import (
    BILLING_ROLES, CLINICAL_ROLES, CurrentUser, require, scope_to_patient,
)

router = APIRouter(prefix="/patients", tags=["patients"])

# Everyone signed in may look a patient up by name or MRN. A receptionist
# needs to find someone to check them in; that is demographic, not
# clinical. Clinical detail is gated on the chart route below.
AnyStaff = Annotated[CurrentUser, Depends(require(*(BILLING_ROLES | CLINICAL_ROLES)))]
Registrar = Annotated[CurrentUser, Depends(require("receptionist", "admin"))]
AnyUser = Annotated[CurrentUser, Depends(require())]


class NewPatient(BaseModel):
    fullName: str = Field(min_length=1)
    age: int = Field(ge=0, lt=130)
    sex: str = Field(pattern="^[MF]$")
    phone: str = Field(min_length=1)
    bloodGroup: str | None = None
    allergies: list[str] = []
    conditions: list[str] = []
    insurance: str | None = None


@router.get("")
async def search_patients(user: AnyStaff, q_: str = Query("", alias="q"),
                          limit: int = Query(50, ge=1, le=200), offset: int = 0):
    async with connection() as conn:
        return await q.search(conn, q_, limit, offset)


@router.post("", status_code=201)
async def register_patient(body: NewPatient, user: Registrar):
    async with connection() as conn:
        return await q.register(conn, user.id, body.model_dump())


@router.get("/{mrn}")
async def get_patient(mrn: str, user: AnyUser):
    scope_to_patient(user, mrn)
    async with connection() as conn:
        patient = await q.get(conn, mrn)
    if patient is None:
        raise HTTPException(status_code=404, detail="No patient with that MRN.")
    return patient


@router.get("/{mrn}/chart")
async def get_chart(mrn: str, user: AnyUser):
    """
    All six tabs. Which are populated depends on the caller's role —
    see queries/chart.py, where the three old row-level security
    policies now live.
    """
    scope_to_patient(user, mrn)

    if user.role == "patient":
        view = chart_q.View.OWN
    elif user.is_clinical:
        view = chart_q.View.CLINICAL
    else:
        view = chart_q.View.BILLING

    async with connection() as conn:
        chart = await chart_q.full(conn, mrn, view)
    if chart is None:
        raise HTTPException(status_code=404, detail="No patient with that MRN.")
    return chart
