# AI route handlers

Six features call a language model. **All six must run server-side.** In v1.0 they
ran from the browser, which is acceptable for a demonstration but means the API key
would be exposed in production. Moving them behind route handlers is migration
step 5, and its acceptance criterion is that no key appears in any client request.

Two further safety checks are **deterministic rules, not AI**, and must stay that
way: the allergy and interaction guard, and the triage acuity suggestion. A safety
block must be reproducible. Those live in `repository-contract.md`.

## Shared constraints

| Constraint | Requirement |
|---|---|
| Human acceptance | Every output lands in an editable field. Nothing writes to the record on its own. |
| Graceful failure | A failed call returns a plain message. The workflow continues manually. Never block a clinical action on an AI response. |
| Data minimisation | Send only the context the task needs. Never bulk-transfer records. |
| Visual marking | All AI output renders in purple with a sparkle icon, so a suggestion is never confusable with recorded fact. |
| Authorisation | Each route checks the caller's role before responding. A cashier must not reach the consultation drafter. |

```ts
// lib/ai.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function complete(system: string, prompt: string, maxTokens = 700) {
  try {
    const r = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    return r.content[0].type === 'text' ? r.content[0].text : null;
  } catch {
    return null;   // caller shows the fallback message
  }
}
```

---

## 1. Consultation co-pilot

`POST /api/ai/draft-note` — role: doctor only

Reads complaint, vitals, age, sex, conditions and allergies. Returns a suggested
diagnosis and plan into two editable fields.

**System prompt**
```
You are a clinical documentation assistant inside a hospital management system.
Be concise, factual and plain-spoken. Never invent patient data beyond what is
given. Return EXACTLY two lines:
DX: <single most likely ICD-10 code and name>
PLAN: <2-3 sentence assessment and plan>
```

**Fallback message:** `AI unavailable — write the note manually.`

The doctor must still supply a diagnosis to sign. The draft does not satisfy that
requirement on its own; it fills a field the doctor then owns.

---

## 2. Result explainer, clinician

`POST /api/ai/explain-result` — roles: doctor, nurse, lab, radiology

**System prompt**
```
Explain this laboratory result to a clinician in 2-3 sentences, noting its
significance and the typical next step. Under 120 words.
```

**Fallback:** `AI unavailable — interpret against the reference range shown.`

---

## 3. Result explainer, patient

`POST /api/ai/explain-result-patient` — role: patient, own results only

The route must verify the result belongs to the caller and is verified. Row-level
security already enforces this, but check explicitly rather than relying on it.

**System prompt**
```
You are a friendly health explainer in a patient app. Explain this test result in
2-3 warm, plain sentences with no jargon and no alarm. End with one practical tip.
Never diagnose. Suggest discussing it with their doctor where relevant. Under 70
words.
```

**Fallback:** `AI unavailable right now — your care team can walk you through this result.`

The UI shows a standing notice beside the explanation: it is not medical advice and
not a diagnosis.

---

## 4. Claims assistant

`POST /api/ai/draft-claim` — roles: cashier, admin

**System prompt**
```
Draft a formal 2-3 sentence insurance claim justification. State the services
delivered and the clinical reason for them. Do not overstate. Under 100 words.
```

**Fallback:** `AI unavailable — write the justification manually.`

The cashier reads and corrects it before sending. The submitted user manual makes
that instruction explicit.

---

## 5. Operations copilot

`POST /api/ai/ops` — role: admin only

Assemble the snapshot server-side from `hospitalSnapshot()`, then pass it as
system context. The model answers from that snapshot only.

**System prompt**
```
You are the operations copilot for MediCare+ General Hospital. Answer ONLY from
the data snapshot below, in 1-3 short sentences with concrete numbers. If the
snapshot does not contain the answer, say so. Never speculate.

Data: <snapshot>
```

Snapshot contents: patient count, bed occupancy per ward, queue waiting and in
triage, pending laboratory orders, pending prescriptions, revenue collected and
outstanding, staff on duty, and claim statuses.

**Fallback:** `AI unavailable right now — check the dashboards above.`

---

## 6. Patient symptom checker

`POST /api/ai/symptom-check` — role: patient

Multi-turn. Send the conversation history plus the patient's own age, sex and
conditions. Nothing about other patients.

**System prompt**
```
You are a symptom checker in a hospital's patient app. Patient context: <age>,
<sex>, history of <conditions>, allergic to <allergies>. Available specialties:
Cardiology, Neurology, Dermatology, Orthopaedics, General Medicine.

In under 80 words: acknowledge what they said, then either ask ONE clarifying
question or recommend a specialty with an urgency level of routine, within 24
hours, or emergency. For emergencies, tell them to call the emergency line
immediately. Never diagnose. Never prescribe. Never name a medication.
```

**Fallback:** `I can't reach the service right now. For urgent symptoms call the emergency line or use Emergency on the home screen.`

The UI carries a permanent non-diagnostic notice in the header, and offers a
"Book an appointment" shortcut once a specialty has been suggested.

---

## Excluded permanently

Autonomous clinical decision-making is not on the roadmap at any release. The
requirement for a human to accept every AI output is a design constraint, not a
temporary limitation, and the submitted documentation commits to it.
