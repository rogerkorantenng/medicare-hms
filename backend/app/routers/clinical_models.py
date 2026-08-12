"""Request bodies for the clinical routes."""

from pydantic import BaseModel, Field


class NewVitals(BaseModel):
    mrn: str
    systolic: int | None = None
    diastolic: int | None = None
    temperature: float | None = None
    pulse: int | None = None
    spo2: int | None = None
    weightKg: float | None = None
    acuity: str | None = None


class StagedLab(BaseModel):
    testName: str
    priority: str = "routine"
    price: float = 0


class StagedImaging(BaseModel):
    modality: str
    bodyRegion: str | None = None
    priority: str = "routine"
    price: float = 0


class StagedRx(BaseModel):
    drug: str
    dose: str
    frequency: str
    duration: str
    quantity: int = 1


class SignEncounter(BaseModel):
    mrn: str
    complaint: str = ""
    # The database enforces this too; the constraint is the real guard.
    diagnosis: str = Field(min_length=1)
    notes: str | None = None
    aiAssisted: bool = False
    labs: list[StagedLab] = []
    imaging: list[StagedImaging] = []
    prescriptions: list[StagedRx] = []
    admission: dict | None = None
    referral: dict | None = None
    followUpDays: int | None = None
    consultationFee: float = 120.0
