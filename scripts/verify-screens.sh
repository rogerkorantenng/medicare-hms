#!/usr/bin/env bash
#
# Loads every screen as the role that owns it, and fails on any that does
# not return 200.
#
# A server component that throws renders as a 500 with a generic error
# page, which is easy to miss by clicking around — one screen out of thirty
# can be broken for a week. This is the cheap check that none is.
#
#   API_PORT=8010 WEB_PORT=3010 ./scripts/verify-screens.sh      # local stack
#   WEB_URL=https://... ./scripts/verify-screens.sh              # deployed
#
set -uo pipefail

WEB="${WEB_URL:-http://localhost:${WEB_PORT:-3000}}"
PASSWORD="${DEMO_PASSWORD:-MediCare2026!Demo}"
JAR="$(mktemp -d)"
trap 'rm -rf "$JAR"' EXIT

pass=0; fail=0

sign_in() {
  curl -s -c "$JAR/$1" -o /dev/null -H 'content-type: application/json' \
    -d "{\"email\":\"$2\",\"password\":\"$PASSWORD\"}" "$WEB/api/session"
}

sign_in doctor       doctor@medicare.com
sign_in nurse        nurse@medicare.com
sign_in receptionist reception@medicare.com
sign_in lab          lab@medicare.com
sign_in radiology    radiology@medicare.com
sign_in pharmacist   pharmacy@medicare.com
sign_in cashier      cashier@medicare.com
sign_in admin        admin@medicare.com
sign_in patient      patient@medicare.com

# role path
SCREENS='
receptionist /workspace/receptionist
receptionist /workspace/receptionist/appointments
receptionist /workspace/receptionist/register
receptionist /workspace/patients
receptionist /workspace/patients/PT-20481
nurse        /workspace/nurse
nurse        /workspace/nurse/wards
nurse        /workspace/nurse/mar
doctor       /workspace/doctor
doctor       /workspace/doctor/orders
doctor       /workspace/doctor/consultation/PT-20481
lab          /workspace/lab
radiology    /workspace/radiology
pharmacist   /workspace/pharmacist
pharmacist   /workspace/pharmacist/inventory
cashier      /workspace/cashier
cashier      /workspace/cashier/claims
admin        /workspace/admin
admin        /workspace/admin/staff
admin        /workspace/admin/audit
patient      /app
patient      /app/book
patient      /app/records
patient      /app/alerts
patient      /app/profile
patient      /app/symptom-checker
'

printf '\033[1mEvery screen, as the role that owns it\033[0m\n'
while read -r role path; do
  [ -z "$role" ] && continue
  code=$(curl -s -b "$JAR/$role" -o /dev/null -w '%{http_code}' "$WEB$path")
  if [ "$code" = "200" ]; then
    printf '  \033[32m✓\033[0m %-12s %s\n' "$role" "$path"; pass=$((pass + 1))
  else
    printf '  \033[31m✗\033[0m %-12s %s → %s\n' "$role" "$path" "$code"; fail=$((fail + 1))
  fi
done <<<"$SCREENS"

printf '\n\033[1mThe three printable documents\033[0m\n'
# The ids are the seed's first prescription, document and invoice.
for doc in "doctor /print/prescription/1" "doctor /print/discharge/1" "cashier /print/receipt/INV-2088"; do
  set -- $doc
  code=$(curl -s -b "$JAR/$1" -o /dev/null -w '%{http_code}' "$WEB$2")
  if [ "$code" = "200" ]; then
    printf '  \033[32m✓\033[0m %-12s %s\n' "$1" "$2"; pass=$((pass + 1))
  else
    printf '  \033[31m✗\033[0m %-12s %s → %s\n' "$1" "$2" "$code"; fail=$((fail + 1))
  fi
done

printf '\n\033[1m%d screens loaded, %d failed\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
