"""
Writes a curl cookie jar holding a session token that is correctly signed
and unexpired, but belongs to a user the database does not have.

That is not a contrived case. It is what every holder of a token has the
moment their account is deactivated, and what everyone has after the
database is reseeded. The middleware reads the role claim without
verifying it, so the browser looks signed in while the API refuses every
request, and that combination used to bounce between the sign-in page and
the workspace until the browser gave up.

    python3 scripts/stale-token.py <jar-path> [host] [secret]
"""

import base64
import hashlib
import hmac
import json
import sys
import time


def part(payload: dict) -> bytes:
    return base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=")


def main() -> None:
    jar_path = sys.argv[1]
    host = sys.argv[2] if len(sys.argv) > 2 else "localhost"
    secret = (sys.argv[3] if len(sys.argv) > 3 else "dev-only-change-me").encode()

    head = part({"alg": "HS256", "typ": "JWT"})
    body = part({
        "sub": "00000000-0000-0000-0000-000000000000",
        "role": "doctor",
        "exp": int(time.time()) + 3600,
    })
    signature = base64.urlsafe_b64encode(
        hmac.new(secret, head + b"." + body, hashlib.sha256).digest()
    ).rstrip(b"=")
    token = (head + b"." + body + b"." + signature).decode()

    with open(jar_path, "w", encoding="utf-8") as jar:
        jar.write("# Netscape HTTP Cookie File\n")
        jar.write(f"#HttpOnly_{host}\tFALSE\t/\tFALSE\t0\tmedicare_session\t{token}\n")


if __name__ == "__main__":
    main()
