from typing import Annotated

from fastapi import APIRouter, Depends

from ..db import connection
from ..security import BILLING_ROLES, CLINICAL_ROLES, CurrentUser, require
from ..serialise import rows

router = APIRouter(tags=["staff"])

AnyStaff = Annotated[CurrentUser, Depends(require(*(BILLING_ROLES | CLINICAL_ROLES)))]
AnyUser = Annotated[CurrentUser, Depends(require())]


@router.get("/staff")
async def staff_directory(user: AnyStaff):
    """The full directory, including every nurse, cashier and staff number."""
    async with connection() as conn:
        return rows(await conn.fetch("select * from staff order by staff_no"))


@router.get("/staff/bookable")
async def bookable_doctors(user: AnyUser):
    """
    Who a patient can book with.

    Deliberately not the directory above. A patient booking an appointment
    needs to choose a doctor, which is a much smaller thing than being able
    to enumerate the hospital's staff — so this returns doctors on duty and
    the four columns the booking screen renders, and nothing else.
    """
    async with connection() as conn:
        return rows(await conn.fetch(
            """select id, full_name, department, on_duty from staff
                where role = 'doctor' and on_duty order by full_name"""))
