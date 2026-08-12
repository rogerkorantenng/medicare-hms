"""Authentication and authorisation for the MediCare+ API."""

from .deps import CurrentUser, CurrentUserDep, get_current_user
from .guards import require, require_own_mrn, scope_to_patient
from .passwords import hash_password, needs_rehash, verify_password
from .roles import ALL_ROLES, BILLING_ROLES, CLINICAL_ROLES, Role, STAFF_ROLES
from .tokens import create_access_token, read_subject, unauthorised

__all__ = [
    "CurrentUser", "CurrentUserDep", "get_current_user",
    "require", "require_own_mrn", "scope_to_patient",
    "hash_password", "verify_password", "needs_rehash",
    "ALL_ROLES", "STAFF_ROLES", "CLINICAL_ROLES", "BILLING_ROLES", "Role",
    "create_access_token", "read_subject", "unauthorised",
]
