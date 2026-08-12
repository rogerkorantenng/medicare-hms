import type { Role } from '@/lib/repository/types';

export interface NavItem { href: string; label: string; icon: string }

/**
 * The sidebar shows only what the role may use. This is a convenience, not a
 * control: typing another role's URL still fails, because the database
 * refuses the query. Navigation reflects permission, it does not create it.
 *
 * Every clinical role lands on the work waiting for them, not a menu of
 * links, so the first item is always the queue or worklist.
 */
export const NAV: Record<Role, NavItem[]> = {
  receptionist: [
    { href: '/workspace/receptionist', label: 'Front Desk', icon: 'desk' },
    { href: '/workspace/receptionist/register', label: 'Register Patient', icon: 'person_add' },
    { href: '/workspace/receptionist/appointments', label: 'Appointments', icon: 'calendar_month' },
    { href: '/workspace/patients', label: 'Patients', icon: 'groups' },
  ],
  nurse: [
    { href: '/workspace/nurse', label: 'Triage Queue', icon: 'emergency' },
    { href: '/workspace/nurse/wards', label: 'Wards and Beds', icon: 'bed' },
    { href: '/workspace/nurse/mar', label: 'Medication Record', icon: 'medication' },
    { href: '/workspace/patients', label: 'Patients', icon: 'groups' },
  ],
  doctor: [
    { href: '/workspace/doctor', label: 'Dashboard', icon: 'dashboard' },
    { href: '/workspace/doctor/orders', label: 'My Orders', icon: 'lab_panel' },
    { href: '/workspace/patients', label: 'Patients', icon: 'groups' },
  ],
  lab: [
    { href: '/workspace/lab', label: 'Sample Worklist', icon: 'science' },
    { href: '/workspace/patients', label: 'Patients', icon: 'groups' },
  ],
  radiology: [
    { href: '/workspace/radiology', label: 'Imaging Worklist', icon: 'radiology' },
    { href: '/workspace/patients', label: 'Patients', icon: 'groups' },
  ],
  pharmacist: [
    { href: '/workspace/pharmacist', label: 'Prescriptions', icon: 'pill' },
    { href: '/workspace/pharmacist/inventory', label: 'Inventory', icon: 'inventory_2' },
  ],
  cashier: [
    { href: '/workspace/cashier', label: 'Invoices', icon: 'receipt_long' },
    { href: '/workspace/cashier/claims', label: 'Insurance Claims', icon: 'health_metrics' },
    { href: '/workspace/patients', label: 'Patients', icon: 'groups' },
  ],
  admin: [
    { href: '/workspace/admin', label: 'Dashboard', icon: 'dashboard' },
    { href: '/workspace/admin/staff', label: 'Staff', icon: 'badge' },
    { href: '/workspace/admin/audit', label: 'Audit Log', icon: 'history' },
    { href: '/workspace/patients', label: 'Patients', icon: 'groups' },
  ],
  patient: [],
};

export const ROLE_LABEL: Record<Role, string> = {
  patient: 'Patient', doctor: 'Doctor', nurse: 'Nurse', receptionist: 'Receptionist',
  lab: 'Laboratory', radiology: 'Radiology', pharmacist: 'Pharmacist',
  cashier: 'Cashier', admin: 'Administrator',
};

/** Three role-specific points, shown once per role on first sign-in. */
export const TOUR: Record<Role, string[]> = {
  receptionist: [
    'Today’s expected patients are on the Front Desk. Checking one in moves them to the triage queue.',
    'Register allocates the MRN when you save — the database assigns it, so two desks cannot collide.',
    'Clinical tabs on a chart will show a restriction notice. That is deliberate.',
  ],
  nurse: [
    'The triage queue is ordered by arrival. Record vitals to move a patient on to the doctor.',
    'The acuity suggestion sits directly under the inputs, so you can see it without scrolling.',
    'Discharging a patient frees the bed and writes the discharge summary in one action.',
  ],
  doctor: [
    'A critical verified result raises a banner at the top of your dashboard.',
    'The order panel stages everything. Nothing dispatches until you sign the consultation.',
    'Draft with AI fills the diagnosis and plan fields, which you then own and can edit.',
  ],
  lab: [
    'STAT samples sort first and are marked. Only the next legal stage is offered.',
    'Verification is the release point — nothing reaches the doctor or patient before it.',
    'A result cannot be verified without a value recorded.',
  ],
  radiology: [
    'The worklist is grouped by modality with priority flags.',
    'Filing a report attaches it to the chart and lists it under documents.',
    'STAT studies sort to the top.',
  ],
  pharmacist: [
    'Dispensing decrements stock automatically. There is no manual adjustment.',
    'An over-dispense fails rather than taking stock negative.',
    'Print the slip from the row before dispensing if the patient wants a copy.',
  ],
  cashier: [
    'Invoice status is derived from the total and what has been paid, so it cannot disagree.',
    'The MoMo flow records the provider in the audit trail by name.',
    'The sparkle button drafts a claim justification for you to read and correct.',
  ],
  admin: [
    'Ask the Ops Copilot a question — it answers only from the live snapshot below.',
    'The live activity feed reads the append-only audit trail.',
    'There is no edit or delete control on the audit log, for anyone, including you.',
  ],
  patient: [],
};
