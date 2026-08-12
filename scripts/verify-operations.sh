#!/usr/bin/env bash
#
# Stock, catalogues, wards, rosters, reports and messages.
#
# Everything here exercises a capability the system did not have: an
# inventory that could only ever empty, a roster that was ten fixed times
# in SQL, an appointment that could never be cancelled.
#
# Safe to run repeatedly. Names that have to be unique carry a per-run
# tag, because the first version of this suite passed once and then
# returned nine 409s on the same database.
#
#   API=http://localhost:8000 ./scripts/verify-operations.sh
#
set -uo pipefail
A=${API:-http://localhost:8000}
P='MediCare2026!Demo'
TAG=$$$(date +%S)
pass=0; fail=0
tok() { curl -s -H 'content-type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$P\"}" "$A/api/auth/login" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])"; }

AD=$(tok admin@medicare.com);   PH=$(tok pharmacy@medicare.com)
CA=$(tok cashier@medicare.com); RC=$(tok reception@medicare.com)
DR=$(tok doctor@medicare.com);  NU=$(tok nurse@medicare.com)
RA=$(tok radiology@medicare.com); LB=$(tok lab@medicare.com)

check() { # name expected method token path [body]
  local code
  if [ -n "${6:-}" ]; then
    code=$(curl -s -o /tmp/sm.json -w '%{http_code}' -X "$3" -H "authorization: Bearer $4" \
             -H 'content-type: application/json' -d "$6" "$A$5")
  else
    code=$(curl -s -o /tmp/sm.json -w '%{http_code}' -X "$3" -H "authorization: Bearer $4" "$A$5")
  fi
  if [ "$code" = "$2" ]; then printf '  \033[32mok\033[0m   %s\n' "$1"; pass=$((pass+1))
  else printf '  \033[31mFAIL\033[0m %s (want %s got %s) %s\n' "$1" "$2" "$code" "$(head -c 130 /tmp/sm.json)"; fail=$((fail+1)); fi
}

echo "--- catalogues (items 6-11) ---"
check "list lab catalogue"    200 GET   "$DR" "/api/catalogue?kind=lab"
check "list departments"      200 GET   "$RC" "/api/catalogue/departments"
check "admin adds a test"     201 POST  "$AD" "/api/catalogue" '{"kind":"lab","name":"Smoke Test Panel '"$TAG"'","price":42}'
check "doctor cannot add"     403 POST  "$DR" "/api/catalogue" '{"kind":"lab","name":"Nope","price":1}'
check "admin adds department" 201 POST  "$AD" "/api/catalogue/departments?name=Smoke%20Dept%20$TAG"

echo "--- inventory and stock (items 1-4) ---"
check "create item"           201 POST  "$PH" "/api/pharmacy/inventory" '{"name":"Smoke Syrup '"$TAG"'","category":"Test","quantity":50,"reorderLevel":10,"unitPrice":3.5}'
ITEM=$(python3 -c "import json;print(json.load(open('/tmp/sm.json'))['id'])")
check "receive stock"         200 POST  "$PH" "/api/pharmacy/inventory/$ITEM/movement" '{"quantity":25,"reason":"Delivery GRN-1"}'
check "write off breakage"    200 POST  "$PH" "/api/pharmacy/inventory/$ITEM/movement" '{"quantity":-5,"reason":"Broken"}'
check "refuse below zero"     409 POST  "$PH" "/api/pharmacy/inventory/$ITEM/movement" '{"quantity":-9999,"reason":"Too many"}'
check "edit reorder level"    200 PATCH "$PH" "/api/pharmacy/inventory/$ITEM" '{"reorderLevel":25,"unitPrice":4}'
check "movement ledger"       200 GET   "$PH" "/api/pharmacy/inventory/$ITEM/movements"
check "cashier cannot stock"  403 POST  "$CA" "/api/pharmacy/inventory/$ITEM/movement" '{"quantity":5,"reason":"no"}'

echo "--- wards and beds (item 9) ---"
WARD="Smoke Ward $TAG"
check "open a ward"           201 POST  "$NU" "/api/wards/wards" "{\"name\":\"$WARD\"}"
check "add a bed"             201 POST  "$NU" "/api/wards/beds" "{\"ward\":\"$WARD\",\"bedNo\":\"SW1\"}"
check "duplicate bed refused" 409 POST  "$NU" "/api/wards/beds" "{\"ward\":\"$WARD\",\"bedNo\":\"SW1\"}"
check "take bed offline"      200 PATCH "$NU" "/api/wards/beds/Smoke%20Ward%20$TAG/SW1" '{"isAvailable":false,"reason":"Deep clean"}'

echo "--- rosters (item 12) ---"
DOC=$(curl -s -H "authorization: Bearer $AD" "$A/api/staff" | python3 -c "
import sys,json;print(next(s['id'] for s in json.load(sys.stdin) if s['role']=='doctor'))")
check "read roster"           200 GET   "$RC" "/api/rosters/$DOC"
check "add a shift"           201 POST  "$AD" "/api/rosters/shifts" "{\"doctorId\":\"$DOC\",\"dayOfWeek\":6,\"startsAt\":\"10:00\",\"endsAt\":\"13:00\",\"slotMinutes\":20}"
SHIFT=$(python3 -c "import json;print(json.load(open('/tmp/sm.json'))['id'])")
check "book leave"            201 POST  "$AD" "/api/rosters/leave" "{\"doctorId\":\"$DOC\",\"startsOn\":\"2027-01-04\",\"endsOn\":\"2027-01-08\",\"reason\":\"Conference\"}"
check "remove the shift"      204 DELETE "$AD" "/api/rosters/shifts/$SHIFT"
check "nurse cannot roster"   403 POST  "$NU" "/api/rosters/shifts" "{\"doctorId\":\"$DOC\",\"dayOfWeek\":1,\"startsAt\":\"09:00\",\"endsAt\":\"10:00\"}"

echo "--- reports and messages (items 38-39) ---"
check "summary report"        200 GET   "$AD" "/api/reports/summary?days=30"
check "audit csv"             200 GET   "$AD" "/api/reports/audit.csv?days=7"
check "doctor cannot report"  403 GET   "$DR" "/api/reports/summary"
check "message a colleague"   201 POST  "$NU" "/api/notifications" "{\"toStaffId\":\"$DOC\",\"title\":\"Please review\",\"body\":\"Bed 3 obs\"}"

printf '\n\033[1m%d passed, %d failed\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
