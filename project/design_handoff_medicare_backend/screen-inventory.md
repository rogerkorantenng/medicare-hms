# Screen inventory

Every screen in the working v1.0 applications, with its role and purpose. Build
these from the HTML references in `design_reference/`, using the repository layer.

The rule that shaped this layout: **every clinical role lands on the work waiting
for them, not a menu of links.** The next action is always the top item on the
first screen they see.

## Shell, all staff roles

| Element | Behaviour |
|---|---|
| Sidebar | Collapsible. Shows only what the role may use. Sign out at the bottom. |
| Top bar | Patient search, notifications with unread dot, date and live clock, name and role chip, ⌘K button |
| Command palette | Ctrl+K or ⌘K. Searches patients and screens. Selecting a result navigates. Escape closes. |
| Toast | Bottom right, dark. Confirms every write within one second. |
| Welcome tour | First sign-in per role only, remembered. Three role-specific points. |
| Reset demo data | Link on the login screen. Restores the seeded baseline. |

## Login

Nine role buttons that fill the email field, password with a show and hide toggle,
sign-in with a loading state, and the reset link.

## Patient portal and mobile

The mobile application is the primary surface. The desktop portal mirrors it for
use at a kiosk or reception terminal.

| Screen | Purpose |
|---|---|
| Onboarding | Four screens on first run, skippable, remembered. Each shows a mini-preview of real UI plus three feature points. |
| Login | Email or phone, password with toggle, forgot password, biometric option, demo note. |
| Home | Next appointment hero card, four quick actions, symptom-checker banner, active medications. |
| Book | Doctor list with rating, horizontal date strip, slot grid with taken slots struck through, confirm, success state. |
| Records | Three tabs. Results with flags and an explain button. Meds with status. Bills with pay. |
| Alerts | Notification list, unread state, mark all read. |
| Profile | Contact details, allergies, notification preference toggles, sign out. |
| Symptom checker | Chat. Non-diagnostic notice in the header. Book shortcut appears once a specialty is suggested. |
| MoMo payment | Bottom sheet. Provider choice, wallet number, send request, awaiting-approval state, success receipt with reference. |

## Receptionist

| Screen | Purpose |
|---|---|
| Front Desk | Today's expected patients. Check in moves them to the triage queue. Walk-in entry. |
| Register Patient | Name, age, sex, phone, blood group, allergies, conditions, insurance. MRN allocated on save. |
| Appointments | Schedule view, booking with slot availability, cancel and reschedule. |

Clinical chart tabs show a restriction notice for this role.

## Nurse

| Screen | Purpose |
|---|---|
| Triage Queue | Patients checked in, ordered by arrival, with a record-vitals action. |
| Record Vitals | BP, temperature, pulse, saturation, weight. Acuity suggestion panel sits **directly under the inputs** (defect D-12). Implausible values rejected. |
| Wards and Beds | Six wards, 34 beds, occupancy per ward. Admit to an empty bed. Discharge frees it and writes a summary. |
| Medication Record | Inpatients with due drugs. Tick records nurse name and time. |

## Doctor

| Screen | Purpose |
|---|---|
| Dashboard | KPI row, critical-result banner at the top when one exists, patient queue with acuity. |
| Consultation | Left: history, allergies, conditions, latest vitals. Centre: complaint, diagnosis, notes, Draft with AI. Right: staged order panel. Sign and complete. |
| My Orders | Orders this doctor placed, with status. |
| Patients | Searchable patient list. |
| Patient Chart | Six tabs: Timeline, Vitals with a systolic trend chart, Results with explain, Medications, Billing, Documents. |

The order panel stages: laboratory test with routine or STAT, imaging with modality
and region, prescription with dose frequency and duration, admission to a ward,
referral to a specialty, and a follow-up interval. Nothing dispatches until the
consultation is signed.

## Laboratory technician

| Screen | Purpose |
|---|---|
| Sample Worklist | STAT first and marked. Four stages: collect, process, enter result, verify. Only the next stage is offered. |
| Result Entry | Value against the reference range shown. Flag computed. |

Verification is the release point. Nothing reaches the doctor or the patient before
it.

## Radiologist

| Screen | Purpose |
|---|---|
| Imaging Worklist | Grouped by modality with priority flags. Mark scanned. |
| Report Entry | Findings attach to the chart and appear under documents. |

## Pharmacist

| Screen | Purpose |
|---|---|
| Prescriptions | Pending queue with drug, dose, frequency, duration, prescriber. Print slip. Dispense. |
| Inventory | Stock with low-stock and expiry flags. |

Dispensing decrements stock automatically. No manual adjustment.

## Cashier

| Screen | Purpose |
|---|---|
| Invoices | Lines, total, paid, derived status. Record cash payment. MoMo button. Print receipt from the row (defect D-13). |
| MoMo flow | Provider, wallet number, send request, patient approved, record payment. Audit names the provider. |
| Insurance Claims | Claim per insured invoice. Advance submitted to authorised to paid. Sparkle button drafts a justification. |

Clinical chart tabs show a restriction notice for this role.

## Administrator

| Screen | Purpose |
|---|---|
| Dashboard | Patient count, appointments today, revenue, bed occupancy, department load. Ops Copilot input. Live Activity feed with a breathing indicator. |
| Staff | Directory with role, department, duty status. |
| Audit Log | Every action, actor, target, timestamp. No edit or delete control exists anywhere. |

## Printable documents

Prescription slip, receipt, and discharge summary. Each carries the hospital
header, the patient identifier, the content, a generated-on line and a signature
line. Print through the browser pipeline on A4 or Letter.
