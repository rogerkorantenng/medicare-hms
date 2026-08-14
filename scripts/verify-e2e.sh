#!/usr/bin/env bash
#
# End-to-end verification, through the browser-facing surface.
#
# The pytest suite proves the API refuses what it should. This proves the
# same thing from the outside — through the Next.js application, over
# cookies, exactly as an examiner clicking around would experience it. It
# is the check that the two halves are actually wired to each other.
#
#   API_PORT=8010 WEB_PORT=3010 ./scripts/verify-e2e.sh          # local stack
#   WEB_URL=https://... API_BASE=https://... ./scripts/verify-e2e.sh   # deployed
#
set -uo pipefail

WEB="${WEB_URL:-http://localhost:${WEB_PORT:-3000}}"
API="${API_BASE:-http://localhost:${API_PORT:-8000}}"
PASSWORD="${DEMO_PASSWORD:-MediCare2026!Demo}"
JAR_DIR="$(mktemp -d)"
trap 'rm -rf "$JAR_DIR"' EXIT

pass=0; fail=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; pass=$((pass + 1)); }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; fail=$((fail + 1)); }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

check() { # description, expected, actual
  if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 — expected $2, got $3"; fi
}

# Signs in and keeps the cookie. Roles are the nine seeded accounts.
sign_in() { # role, email
  curl -s -c "$JAR_DIR/$1" -o "$JAR_DIR/$1.json" -w '%{http_code}' \
    -H 'content-type: application/json' \
    -d "{\"email\":\"$2\",\"password\":\"$PASSWORD\"}" \
    "$WEB/api/session"
}

# Fetches a page as a signed-in role, following nothing.
as() { # role, path -> "status redirect"
  curl -s -b "$JAR_DIR/$1" -o "$JAR_DIR/body" -w '%{http_code} %{redirect_url}' "$WEB$2"
}

status() { as "$1" "$2" | cut -d' ' -f1; }

step "The API and the application are both up"
check "API health"   "200" "$(curl -s -o /dev/null -w '%{http_code}' "$API/health")"
check "Sign-in page" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$WEB/login")"

step "Signing out, the workspace is unreachable"
for path in /workspace/doctor /workspace/admin/audit /app/records; do
  redirect=$(curl -s -o /dev/null -w '%{redirect_url}' "$WEB$path")
  case "$redirect" in
    */login\?next=*) ok "$path redirects to sign-in" ;;
    *)               bad "$path did not redirect to sign-in (got '${redirect:-none}')" ;;
  esac
done

step "All nine role accounts sign in"
declare -A EMAIL=(
  [doctor]=doctor@medicare.com          [nurse]=nurse@medicare.com
  [receptionist]=reception@medicare.com [lab]=lab@medicare.com
  [radiology]=radiology@medicare.com    [pharmacist]=pharmacy@medicare.com
  [cashier]=cashier@medicare.com        [admin]=admin@medicare.com
  [patient]=patient@medicare.com
)
for role in "${!EMAIL[@]}"; do
  check "$role signs in" "200" "$(sign_in "$role" "${EMAIL[$role]}")"
done

step "The session token never reaches the browser"
if grep -q '#HttpOnly_' "$JAR_DIR/doctor"; then
  ok "session cookie is HttpOnly"
else
  bad "session cookie is readable from JavaScript"
fi
if grep -qi 'access_token' "$JAR_DIR/doctor.json"; then
  bad "the sign-in response body carried the token to the browser"
else
  ok "the sign-in response body carries no token"
fi

step "A wrong password is refused"
check "bad password" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' \
      -d '{"email":"doctor@medicare.com","password":"not-the-password"}' "$WEB/api/session")"

step "Each role reaches its own workspace"
for role in doctor nurse receptionist lab radiology pharmacist cashier admin; do
  check "$role opens /workspace/$role" "200" "$(status "$role" "/workspace/$role")"
done
check "patient opens /app" "200" "$(status patient /app)"

step "Roles are kept out of the wrong surface"
read -r code redirect <<<"$(as patient /workspace/doctor)"
case "$redirect" in
  */app) ok "a patient is sent back to the patient app" ;;
  *)     bad "a patient reached the workspace (status $code, redirect '${redirect:-none}')" ;;
esac
read -r code redirect <<<"$(as doctor /app)"
case "$redirect" in
  */workspace/doctor) ok "a doctor is sent back to the workspace" ;;
  *)                  bad "a doctor reached the patient app (status $code, redirect '${redirect:-none}')" ;;
esac

step "The audit trail is admin-only, from the client"
check "admin opens the audit trail" "200" "$(status admin /workspace/admin/audit)"
check "the audit API refuses a doctor" "403" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR_DIR/doctor" "$WEB/api/ai/ops" \
      -H 'content-type: application/json' -d '{"question":"how many beds are free?"}')"

step "A cashier gets billing without clinical data (TC-96)"
# The discriminators are a result VALUE and a drug name, not a test name:
# "Lipid Panel" is also the description of a billed line, so a cashier
# seeing that string is correct rather than a leak.
# Markers that only ever appear on a clinical record. A drug name is not
# one: "Lisinopril 10mg x30" is a line on the invoice, because the
# hospital bills for the medicine, so grepping for it accused the cashier
# of a leak for correctly showing a bill. The result value and the
# frequency have no billable equivalent.
CLINICAL='LDL 128\|Once daily'
as doctor  /workspace/patients/PT-20481 >/dev/null; cp "$JAR_DIR/body" "$JAR_DIR/chart-doctor.html"
as cashier /workspace/patients/PT-20481 >/dev/null; cp "$JAR_DIR/body" "$JAR_DIR/chart-cashier.html"
if grep -q "$CLINICAL" "$JAR_DIR/chart-doctor.html"; then
  ok "the doctor's chart shows the result value and the prescription"
else
  bad "the doctor's chart showed neither — the check below would prove nothing"
fi
if grep -q "$CLINICAL" "$JAR_DIR/chart-cashier.html"; then
  bad "clinical data leaked into the cashier's view of the same chart"
else
  ok "the cashier's view of the same chart carries neither"
fi
if grep -q 'Lipid Panel' "$JAR_DIR/chart-cashier.html"; then
  ok "the cashier does see the billed line, which is the point of the split"
else
  bad "the cashier could not see the billed line either"
fi

step "A patient cannot open another patient's record (TC-99)"
check "own record" "200" "$(status patient /app/records)"
# Search is the only route from which a patient could name another MRN. It
# is scoped to them, so the answer is an empty list rather than a refusal —
# which is the stronger behaviour: nothing is revealed about PT-20492, not
# even that it exists.
found=$(curl -s -b "$JAR_DIR/patient" "$WEB/api/patients/search?q=PT-20492")
case "$found" in
  *PT-20492*) bad "searching as a patient returned another patient: $found" ;;
  *)          ok "searching as a patient does not return another patient" ;;
esac
# And the AI route that reads a patient's own record refuses a doctor,
# because it is the patient-facing one.
check "the patient symptom checker refuses a doctor" "403" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR_DIR/doctor" \
      -H 'content-type: application/json' \
      -d '{"history":[{"role":"user","content":"hello"}]}' \
      "$WEB/api/ai/symptom-check")"

step "A token the API no longer recognises does not trap the browser"
# Deactivating an account, or reseeding, leaves people holding a token that
# looks valid to the middleware and is refused by the API. That combination
# used to bounce between the sign-in page and the workspace until the
# browser gave up with ERR_TOO_MANY_REDIRECTS.
STALE="$JAR_DIR/stale"
python3 "$(dirname "$0")/stale-token.py" "$STALE" "$(echo "$WEB" | sed -E 's#https?://##; s#:.*##')"
read -r hops final <<<"$(curl -s -L --max-redirs 10 -b "$STALE" -c "$STALE" \
  -o "$JAR_DIR/stale.html" -w '%{num_redirects} %{url_effective}' "$WEB/workspace/doctor")"
case "$final" in
  */login*) ok "a stale token lands on sign-in, after $hops redirects" ;;
  *)        bad "a stale token ended at '$final' after $hops redirects" ;;
esac
if grep -q 'session ended' "$JAR_DIR/stale.html"; then
  ok "the sign-in page explains why"
else
  bad "the sign-in page did not explain that the session had ended"
fi

step "Signing out clears the session"
curl -s -X DELETE -b "$JAR_DIR/doctor" -c "$JAR_DIR/doctor" -o /dev/null "$WEB/api/session"
read -r code redirect <<<"$(as doctor /workspace/doctor)"
case "$redirect" in
  */login*) ok "after signing out the workspace redirects to sign-in" ;;
  *)        bad "the workspace was still reachable after signing out (status $code)" ;;
esac

printf '\n\033[1m%d passed, %d failed\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
