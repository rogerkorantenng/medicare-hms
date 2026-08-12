#!/usr/bin/env bash
#
# Appointments, clinical corrections, billing and portal access.
#
# Safe to run repeatedly against the same database. Anything that can only
# happen once to a given record is done to a record this run creates, so
# the suite does not quietly depend on being the first to touch the seed.
#
#   API=http://localhost:8000 ./scripts/verify-records.sh
#
set -uo pipefail
A=${API:-http://localhost:8000}
P='MediCare2026!Demo'
TAG=$$$(date +%S)
pass=0; fail=0
tok() { curl -s -H 'content-type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$P\"}" "$A/api/auth/login" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])"; }
AD=$(tok admin@medicare.com);   CA=$(tok cashier@medicare.com)
RC=$(tok reception@medicare.com); DR=$(tok doctor@medicare.com)
NU=$(tok nurse@medicare.com);   LB=$(tok lab@medicare.com)
RA=$(tok radiology@medicare.com)

check() {
  local code
  if [ -n "${6:-}" ]; then
    code=$(curl -s -o /tmp/s2.json -w '%{http_code}' -X "$3" -H "authorization: Bearer $4" \
             -H 'content-type: application/json' -d "$6" "$A$5")
  else
    code=$(curl -s -o /tmp/s2.json -w '%{http_code}' -X "$3" -H "authorization: Bearer $4" "$A$5")
  fi
  if [ "$code" = "$2" ]; then printf '  \033[32mok\033[0m   %s\n' "$1"; pass=$((pass+1))
  else printf '  \033[31mFAIL\033[0m %s (want %s got %s) %s\n' "$1" "$2" "$code" "$(head -c 140 /tmp/s2.json)"; fail=$((fail+1)); fi
}
jq_() { python3 -c "import json,sys;print(json.load(open('/tmp/s2.json'))$1)"; }

echo "--- appointments (items 13-16) ---"
DOC=$(curl -s -H "authorization: Bearer $AD" "$A/api/staff" | python3 -c "
import sys,json;print(next(s['id'] for s in json.load(sys.stdin) if s['role']=='doctor'))")
DAY=$(date -d '+8 days' +%F); [ "$(date -d "$DAY" +%u)" -gt 5 ] && DAY=$(date -d '+10 days' +%F)
SLOT=$(curl -s -H "authorization: Bearer $RC" "$A/api/appointments/free-slots?doctor_id=$DOC&day=$DAY" \
        | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0] if d else '')")
check "book from the roster"  201 POST "$RC" "/api/appointments" \
  "{\"mrn\":\"PT-20492\",\"doctorId\":\"$DOC\",\"apptDate\":\"$DAY\",\"apptTime\":\"$SLOT\",\"apptType\":\"Consultation\"}"
APPT=$(jq_ "['id']")
NEXT=$(curl -s -H "authorization: Bearer $RC" "$A/api/appointments/free-slots?doctor_id=$DOC&day=$DAY" \
        | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0] if d else '')")
check "reschedule it"         200 POST "$RC" "/api/appointments/$APPT/reschedule" \
  "{\"apptDate\":\"$DAY\",\"apptTime\":\"$NEXT\"}"
check "cancel it"             204 POST "$RC" "/api/appointments/$APPT/cancel" '{"reason":"Patient rang to cancel"}'
check "cancelling twice fails" 409 POST "$RC" "/api/appointments/$APPT/cancel" '{"reason":"again"}'

echo "--- clinical corrections (items 22-27, 29) ---"
check "file a referral"       201 POST "$DR" "/api/documents" \
  '{"mrn":"PT-20481","title":"Referral to Cardiology","kind":"referral","body":"Please see this patient."}'
ENC=$(curl -s -H "authorization: Bearer $DR" "$A/api/patients/PT-20481/chart" \
      | python3 -c "import sys,json;e=json.load(sys.stdin)['encounters'];print(e[0]['id'] if e else '')")
check "add an addendum"       201 POST "$DR" "/api/encounters/$ENC/addendum" \
  '{"body":"Correction: blood pressure was 148/92, not 138/86."}'
VIT=$(curl -s -H "authorization: Bearer $DR" "$A/api/patients/PT-20481/chart" \
      | python3 -c "import sys,json;v=json.load(sys.stdin)['vitals'];print(v[0]['id'] if v else '')")
check "correct a vital"       201 POST "$NU" "/api/vitals/$VIT/correct" \
  '{"note":"Transposed digits","systolic":148,"diastolic":92}'
check "re-triage in the queue" 204 POST "$NU" "/api/queue/PT-20536/acuity" \
  '{"acuity":"urgent","reason":"Deteriorated while waiting"}'
# The next two blocks used to grab whichever seeded order happened to be
# waiting, which meant the suite passed once and then failed on a database
# it had already run against. It orders its own work now.
curl -s -o /dev/null -H "authorization: Bearer $DR" -H 'content-type: application/json' \
  -d '{"mrn":"PT-20481","diagnosis":"For the verification suite",
       "labs":[{"testName":"Full Blood Count","price":40}],
       "imaging":[{"modality":"X-Ray","bodyRegion":"Chest","price":90}]}' \
  "$A/api/encounters"
newest() { # worklist-path status token
  curl -s -H "authorization: Bearer $3" "$A$1" | python3 -c "
import sys, json
d = [o for o in json.load(sys.stdin) if o['status'] == '$2']
print(max((o['id'] for o in d), default=''))"; }

LAB=$(newest /api/lab/worklist ordered "$LB")
check "collect the sample"    204 POST "$LB" "/api/lab/$LAB/advance" '{"next":"collected"}'
check "reject a sample"       204 POST "$LB" "/api/lab/$LAB/reject" '{"reason":"Haemolysed"}'
IMG=$(newest /api/imaging/worklist ordered "$RA")
check "schedule a scan"       204 POST "$RA" "/api/imaging/$IMG/advance?next=scheduled"
check "mark it scanned"       204 POST "$RA" "/api/imaging/$IMG/advance?next=scanned"
check "cannot skip a step"    409 POST "$RA" "/api/imaging/$IMG/advance?next=scheduled"

echo "--- billing (items 17-21) ---"
INV=$(curl -s -H "authorization: Bearer $CA" "$A/api/invoices" \
      | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
check "add a manual charge"   201 POST "$CA" "/api/invoices/$INV/line" '{"description":"Dressing","amount":40}'
check "take a payment"        204 POST "$CA" "/api/invoices/$INV/payment" '{"amount":50,"method":"cash"}'
check "refund part of it"     204 POST "$CA" "/api/invoices/$INV/refund" '{"amount":10,"reason":"Overcharged"}'
check "refuse over-refund"    409 POST "$CA" "/api/invoices/$INV/refund" '{"amount":99999,"reason":"too much"}'
check "write off a balance"   204 POST "$CA" "/api/invoices/$INV/write-off" '{"amount":5,"reason":"Goodwill"}'
check "payment history"       200 GET  "$CA" "/api/invoices/$INV/payments"
check "raise a claim"         201 POST "$CA" "/api/claims" "{\"invoiceId\":\"$INV\",\"insurer\":\"NHIS\",\"amount\":60}"
CLM=$(jq_ "['id']")
check "insurer rejects it"    204 POST "$CA" "/api/claims/$CLM/reject" '{"reason":"Missing referral"}'

echo "--- portal access (item 35) ---"
# A fresh registration, for the same reason: granting a login twice is one
# of the things under test, so the suite cannot reuse a patient it granted
# on the last run.
check "register a patient"    201 POST "$RC" "/api/patients" \
  "{\"fullName\":\"Verification Patient $TAG\",\"age\":31,\"sex\":\"F\",\"phone\":\"0244000$TAG\"}"
MRN=$(jq_ "['mrn']")
check "grant patient a login" 201 POST "$RC" "/api/patients/$MRN/portal-access" \
  "{\"email\":\"verify.$TAG@example.com\",\"password\":\"TemporaryPass99!\"}"
check "the patient signs in"  200 POST "$RC" "/api/auth/login" \
  "{\"email\":\"verify.$TAG@example.com\",\"password\":\"TemporaryPass99!\"}"
check "cannot grant twice"    409 POST "$RC" "/api/patients/$MRN/portal-access" \
  "{\"email\":\"other.$TAG@example.com\",\"password\":\"TemporaryPass99!\"}"

printf '\n\033[1m%d passed, %d failed\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
