"""The accounts the seed creates, matching the login screen in the design."""

# Nine sign-in accounts, one per role. All take DEMO_PASSWORD.
ACCOUNTS: list[tuple[str, str]] = [
    ("patient@medicare.com", "patient"),
    ("doctor@medicare.com", "doctor"),
    ("nurse@medicare.com", "nurse"),
    ("reception@medicare.com", "receptionist"),
    ("lab@medicare.com", "lab"),
    ("radiology@medicare.com", "radiology"),
    ("pharmacy@medicare.com", "pharmacist"),
    ("cashier@medicare.com", "cashier"),
    ("admin@medicare.com", "admin"),
]

# Schedulable staff with no password, so they fill the booking roster
# but nobody can sign in as them.
ROSTER_DOCTORS: list[str] = [
    "emily.parker@medicare.com",
    "lisa.thompson@medicare.com",
    "james.wilson@medicare.com",
]
