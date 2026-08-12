"""
Role sets — the vocabulary the guards are written in.

These mirror the row-level security helper functions they replaced, one
for one, so the authorisation model is unchanged even though its
enforcement point moved into the application.
"""

Role = str

ALL_ROLES: set[Role] = {
    "patient", "doctor", "nurse", "receptionist",
    "lab", "radiology", "pharmacist", "cashier", "admin",
}

# Mirrors public.is_clinical(): who may read a chart.
CLINICAL_ROLES: set[Role] = {"doctor", "nurse", "lab", "radiology", "pharmacist", "admin"}

# Mirrors public.is_staff(): everyone except the patient.
STAFF_ROLES: set[Role] = ALL_ROLES - {"patient"}

# Who may see money. This split is the point of the design: a cashier
# bills without ever reading a consultation note.
BILLING_ROLES: set[Role] = {"cashier", "receptionist", "admin", "doctor", "pharmacist"}
