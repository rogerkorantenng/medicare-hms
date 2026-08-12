import { supabaseServer, currentUser } from '@/lib/supabase/server';
import { checkSafety } from './safety';
import type {
  Repository, Patient, NewPatient, PatientChart, Appointment, NewAppointment,
  QueueEntry, Vitals, NewVitals, SignEncounterInput, SafetyResult, LabOrder,
  LabStatus, ResultInput, ImagingOrder, Prescription, InventoryItem, Ward, Bed,
  MarEntry, Invoice, Claim, Kpis, AuditEntry, Staff, OpsSnapshot, AppNotification,
  MomoProvider, Encounter, ClinicalDocument,
} from './types';

/** Supabase returns snake_case; the UI speaks camelCase. One place to translate. */
type Row = Record<string, any>;

const toPatient = (r: Row): Patient => ({
  mrn: r.mrn, authUserId: r.auth_user_id ?? null, fullName: r.full_name,
  age: r.age, sex: r.sex, phone: r.phone, bloodGroup: r.blood_group ?? null,
  allergies: r.allergies ?? [], conditions: r.conditions ?? [],
  insurance: r.insurance ?? null, lastVisit: r.last_visit ?? null,
});

const toVitals = (r: Row): Vitals => ({
  id: r.id, mrn: r.mrn, recordedBy: r.recorded_by,
  recordedByName: r.staff?.full_name,
  systolic: r.systolic, diastolic: r.diastolic, temperature: r.temperature,
  pulse: r.pulse, spo2: r.spo2, weightKg: r.weight_kg,
  acuity: r.acuity ?? null, recordedAt: r.recorded_at,
});

const toLab = (r: Row): LabOrder => ({
  id: r.id, mrn: r.mrn, patientName: r.patients?.full_name,
  encounterId: r.encounter_id ?? null, orderedBy: r.ordered_by,
  orderedByName: r.staff?.full_name,
  testName: r.test_name, priority: r.priority, status: r.status,
  resultValue: r.result_value ?? null, refRange: r.ref_range ?? null,
  flag: r.flag ?? null, verifiedBy: r.verified_by ?? null,
  verifiedAt: r.verified_at ?? null, price: Number(r.price ?? 0),
  createdAt: r.created_at,
});

const toImaging = (r: Row): ImagingOrder => ({
  id: r.id, mrn: r.mrn, patientName: r.patients?.full_name,
  encounterId: r.encounter_id ?? null, orderedBy: r.ordered_by,
  modality: r.modality, bodyRegion: r.body_region ?? null,
  priority: r.priority, status: r.status, findings: r.findings ?? null,
  reportedBy: r.reported_by ?? null, price: Number(r.price ?? 0),
  createdAt: r.created_at,
});

const toRx = (r: Row): Prescription => ({
  id: r.id, mrn: r.mrn, patientName: r.patients?.full_name,
  encounterId: r.encounter_id ?? null, prescriberId: r.prescriber_id,
  prescriberName: r.staff?.full_name,
  drug: r.drug, dose: r.dose, frequency: r.frequency, duration: r.duration,
  quantity: r.quantity, status: r.status, dispensedBy: r.dispensed_by ?? null,
  dispensedAt: r.dispensed_at ?? null, createdAt: r.created_at,
});

const toEncounter = (r: Row): Encounter => ({
  id: r.id, mrn: r.mrn, doctorId: r.doctor_id, doctorName: r.staff?.full_name,
  complaint: r.complaint, diagnosis: r.diagnosis, notes: r.notes ?? null,
  aiAssisted: r.ai_assisted, createdAt: r.created_at,
});

const toDoc = (r: Row): ClinicalDocument => ({
  id: r.id, mrn: r.mrn, title: r.title, kind: r.kind, body: r.body ?? null,
  docDate: r.doc_date, createdBy: r.created_by ?? null,
});

const toAppointment = (r: Row): Appointment => ({
  id: r.id, mrn: r.mrn, patientName: r.patients?.full_name,
  doctorId: r.doctor_id, doctorName: r.staff?.full_name,
  specialty: r.specialty ?? null, apptDate: r.appt_date,
  apptTime: String(r.appt_time).slice(0, 5), apptType: r.appt_type, status: r.status,
});

const toInvoice = (r: Row): Invoice => ({
  id: r.id, mrn: r.mrn, patientName: r.patients?.full_name,
  total: Number(r.total ?? 0), paid: Number(r.paid ?? 0), status: r.status,
  createdAt: r.created_at,
  lines: (r.invoice_lines ?? []).map((l: Row) => ({
    id: l.id, description: l.description, amount: Number(l.amount), createdAt: l.created_at,
  })),
});

const toStaff = (r: Row): Staff => ({
  id: r.id, staffNo: r.staff_no, fullName: r.full_name, role: r.role,
  department: r.department ?? null, onDuty: r.on_duty,
});

const toAudit = (r: Row): AuditEntry => ({
  id: r.id, staffId: r.staff_id ?? null, actorName: r.actor_name,
  action: r.action, target: r.target ?? null, occurredAt: r.occurred_at,
});

/** Postgres errors are precise but not phrased for a clinician. */
function humanise(message: string): string {
  if (/encounters_diagnosis_check/.test(message))
    return 'A diagnosis is required to sign a consultation.';
  if (/appt_no_double_booking/.test(message))
    return 'That slot has just been taken. Choose another time.';
  if (/bed_one_patient_only/.test(message))
    return 'That patient already occupies a bed.';
  if (/inventory_items_quantity_check/.test(message))
    return 'There is not enough stock to dispense that quantity.';
  if (/vitals_.*_check/.test(message))
    return 'One of those readings is outside a plausible range. Check and re-enter.';
  if (/Illegal lab status transition/.test(message))
    return 'Laboratory stages advance one at a time.';
  if (/row-level security/i.test(message))
    return 'Your role does not permit that action.';
  return message;
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(humanise(res.error.message));
  return res.data as T;
}

export class SupabaseRepository implements Repository {
  private db() { return supabaseServer(); }

  // ================= patients =================

  async registerPatient(input: NewPatient): Promise<Patient> {
    const row = unwrap(await this.db().rpc('register_patient', {
      p_full_name: input.fullName, p_age: input.age, p_sex: input.sex,
      p_phone: input.phone, p_blood_group: input.bloodGroup ?? null,
      p_allergies: input.allergies ?? [], p_conditions: input.conditions ?? [],
      p_insurance: input.insurance ?? null,
    }));
    return toPatient(row as Row);
  }

  async searchPatients(query: string): Promise<Patient[]> {
    const q = query.trim();
    let req = this.db().from('patients')
      .select('*').order('last_visit', { ascending: false }).limit(50);
    if (q) req = req.or(`full_name.ilike.%${q}%,mrn.ilike.%${q}%,phone.ilike.%${q}%`);
    return (unwrap(await req) as Row[]).map(toPatient);
  }

  async getPatient(mrn: string): Promise<Patient | null> {
    const { data, error } = await this.db().from('patients').select('*').eq('mrn', mrn).maybeSingle();
    if (error) throw new Error(humanise(error.message));
    return data ? toPatient(data) : null;
  }

  /** All six chart tabs in one call, as the contract requires. */
  async getPatientChart(mrn: string): Promise<PatientChart> {
    const db = this.db();
    const [patient, encounters, vitals, labs, imaging, rx, docs, invoices, bed] = await Promise.all([
      db.from('patients').select('*').eq('mrn', mrn).maybeSingle(),
      db.from('encounters').select('*, staff:doctor_id(full_name)').eq('mrn', mrn).order('created_at', { ascending: false }),
      db.from('vitals').select('*, staff:recorded_by(full_name)').eq('mrn', mrn).order('recorded_at', { ascending: false }),
      db.from('lab_orders').select('*').eq('mrn', mrn).order('created_at', { ascending: false }),
      db.from('imaging_orders').select('*').eq('mrn', mrn).order('created_at', { ascending: false }),
      db.from('prescriptions').select('*, staff:prescriber_id(full_name)').eq('mrn', mrn).order('created_at', { ascending: false }),
      db.from('documents').select('*').eq('mrn', mrn).order('doc_date', { ascending: false }),
      db.from('invoices').select('*, invoice_lines(*)').eq('mrn', mrn).order('created_at', { ascending: false }),
      db.from('ward_beds').select('*').eq('mrn', mrn).maybeSingle(),
    ]);

    if (!patient.data) throw new Error(`No patient with MRN ${mrn}.`);

    return {
      patient: toPatient(patient.data),
      // A cashier or receptionist gets an empty array here rather than an
      // error: row-level security returns no rows, and the screen shows its
      // restriction notice.
      encounters: (encounters.data ?? []).map(toEncounter),
      vitals: (vitals.data ?? []).map(toVitals),
      labs: (labs.data ?? []).map(toLab),
      imaging: (imaging.data ?? []).map(toImaging),
      prescriptions: (rx.data ?? []).map(toRx),
      documents: (docs.data ?? []).map(toDoc),
      invoices: (invoices.data ?? []).map(toInvoice),
      bed: bed.data ? { ward: bed.data.ward, bedNo: bed.data.bed_no, mrn: bed.data.mrn,
                        patientName: patient.data.full_name, admittedAt: bed.data.admitted_at } : null,
    };
  }

  // ================= appointments and queue =================

  /** Queries the roster AND the bookings. Defect D-03. */
  async freeSlots(doctorId: string, date: string): Promise<string[]> {
    const rows = unwrap(await this.db().rpc('free_slots', { p_doctor: doctorId, p_date: date }));
    return (rows as unknown as string[]).map((s) => String(s).slice(0, 5));
  }

  async bookAppointment(input: NewAppointment): Promise<Appointment> {
    const row = unwrap(await this.db().from('appointments').insert({
      mrn: input.mrn, doctor_id: input.doctorId, specialty: input.specialty ?? null,
      appt_date: input.apptDate, appt_time: input.apptTime,
      appt_type: input.apptType ?? 'Consultation',
    }).select('*').single());
    return toAppointment(row as unknown as Row);
  }

  async checkIn(appointmentId: number): Promise<void> {
    unwrap(await this.db().rpc('check_in_appointment', { p_appt: appointmentId }));
  }

  async addWalkIn(mrn: string): Promise<void> {
    unwrap(await this.db().rpc('add_walk_in', { p_mrn: mrn }));
  }

  /**
   * The queue is derived, not stored — the entity model has no queue table
   * and none was added. A checked-in appointment is a queue entry: waiting
   * until a nurse records vitals, ready for the doctor afterwards.
   */
  private async queue(doctorId?: string): Promise<QueueEntry[]> {
    const db = this.db();
    const today = new Date().toISOString().slice(0, 10);

    let req = db.from('appointments')
      .select('id, mrn, doctor_id, specialty, appt_type, appt_time, patients(full_name, age, sex)')
      .eq('status', 'checked_in').eq('appt_date', today).order('appt_time');
    if (doctorId) req = req.eq('doctor_id', doctorId);

    const appts = (unwrap(await req) as Row[]) ?? [];
    if (!appts.length) return [];

    const mrns = appts.map((a) => a.mrn);
    const vitals = (unwrap(await db.from('vitals').select('*')
      .in('mrn', mrns).gte('recorded_at', `${today}T00:00:00`)
      .order('recorded_at', { ascending: false })) as Row[]) ?? [];

    const latest = new Map<string, Row>();
    for (const v of vitals) if (!latest.has(v.mrn)) latest.set(v.mrn, v);

    return appts.map((a) => {
      const v = latest.get(a.mrn);
      return {
        mrn: a.mrn,
        patientName: a.patients?.full_name ?? a.mrn,
        age: a.patients?.age ?? 0,
        sex: a.patients?.sex ?? 'F',
        reason: a.appt_type === 'Walk-in' ? 'Walk-in' : (a.specialty ?? a.appt_type),
        waitingSince: String(a.appt_time).slice(0, 5),
        acuity: v?.acuity ?? null,
        stage: v ? 'ready_for_doctor' : 'waiting',
        appointmentId: a.id,
        doctorId: a.doctor_id,
        vitals: v ? toVitals(v) : null,
      } as QueueEntry;
    });
  }

  triageQueue(): Promise<QueueEntry[]> { return this.queue(); }
  doctorQueue(doctorId: string): Promise<QueueEntry[]> { return this.queue(doctorId); }

  // ================= triage =================

  async recordVitals(input: NewVitals): Promise<Vitals> {
    const me = await currentUser();
    const row = unwrap(await this.db().from('vitals').insert({
      mrn: input.mrn, recorded_by: me!.id,
      systolic: input.systolic ?? null, diastolic: input.diastolic ?? null,
      temperature: input.temperature ?? null, pulse: input.pulse ?? null,
      spo2: input.spo2 ?? null, weight_kg: input.weightKg ?? null,
      acuity: input.acuity ?? null,
    }).select('*').single()) as unknown as Row;
    await this.db().rpc('write_audit', { p_action: 'Recorded vitals', p_target: input.mrn });
    return toVitals(row);
  }

  // ================= consultation =================

  /** One transaction. All of it commits or none of it does. */
  async signEncounter(input: SignEncounterInput): Promise<void> {
    unwrap(await this.db().rpc('sign_encounter', {
      p: {
        mrn: input.mrn, complaint: input.complaint, diagnosis: input.diagnosis,
        notes: input.notes ?? null, aiAssisted: input.aiAssisted ?? false,
        labs: input.labs ?? [], imaging: input.imaging ?? [],
        prescriptions: input.prescriptions ?? [],
        admission: input.admission ?? null, referral: input.referral ?? null,
        followUpDays: input.followUpDays ?? null,
        consultationFee: input.consultationFee ?? 120,
      },
    }));
  }

  /** Deterministic. See safety.ts — never AI, and there is no override. */
  async checkPrescriptionSafety(mrn: string, drug: string): Promise<SafetyResult> {
    const db = this.db();
    const [patient, active] = await Promise.all([
      db.from('patients').select('full_name, allergies').eq('mrn', mrn).maybeSingle(),
      db.from('prescriptions').select('drug').eq('mrn', mrn).eq('status', 'pending'),
    ]);
    if (!patient.data) throw new Error(`No patient with MRN ${mrn}.`);
    return checkSafety(
      patient.data.full_name,
      patient.data.allergies ?? [],
      (active.data ?? []) as { drug: string }[],
      drug,
    );
  }

  // ================= diagnostics =================

  /** STAT first, then oldest first. */
  async labWorklist(): Promise<LabOrder[]> {
    const rows = unwrap(await this.db().from('lab_orders')
      .select('*, patients(full_name)')
      .neq('status', 'verified')
      .order('priority', { ascending: false })
      .order('created_at')) as Row[];
    return rows.map(toLab);
  }

  /**
   * Only ever the next stage. The trigger refuses a skip, and the screen
   * offers a single action so the error cannot be reached in normal use.
   */
  async advanceLabOrder(id: number, next: LabStatus, result?: ResultInput): Promise<void> {
    const patch: Row = { status: next };
    if (result) {
      patch.result_value = result.resultValue;
      if (result.refRange !== undefined) patch.ref_range = result.refRange;
      if (result.flag !== undefined) patch.flag = result.flag;
    }
    unwrap(await this.db().from('lab_orders').update(patch).eq('id', id).select('id').single());
    await this.db().rpc('write_audit', {
      p_action: next === 'verified' ? 'Verified result' : `Lab order ${next}`,
      p_target: `lab order ${id}`,
    });
  }

  async imagingWorklist(): Promise<ImagingOrder[]> {
    const rows = unwrap(await this.db().from('imaging_orders')
      .select('*, patients(full_name)')
      .neq('status', 'reported')
      .order('priority', { ascending: false })
      .order('created_at')) as Row[];
    return rows.map(toImaging);
  }

  async reportImaging(id: number, findings: string): Promise<void> {
    const me = await currentUser();
    unwrap(await this.db().from('imaging_orders')
      .update({ status: 'reported', findings, reported_by: me!.id })
      .eq('id', id).select('id').single());
    await this.db().rpc('write_audit', { p_action: 'Reported imaging', p_target: `imaging order ${id}` });
  }

  // ================= pharmacy =================

  async pendingPrescriptions(): Promise<Prescription[]> {
    const rows = unwrap(await this.db().from('prescriptions')
      .select('*, patients(full_name), staff:prescriber_id(full_name)')
      .eq('status', 'pending').order('created_at')) as Row[];
    return rows.map(toRx);
  }

  /** Calls the database function. Never read-subtract-write; that was D-05. */
  async dispense(prescriptionId: number): Promise<void> {
    const me = await currentUser();
    unwrap(await this.db().rpc('dispense_prescription', {
      p_rx_id: prescriptionId, p_staff: me!.id,
    }));
    await this.db().rpc('write_audit', {
      p_action: 'Dispensed prescription', p_target: `rx ${prescriptionId}`,
    });
  }

  async inventory(): Promise<InventoryItem[]> {
    const rows = unwrap(await this.db().from('inventory_items').select('*').order('name')) as Row[];
    const soon = new Date(); soon.setMonth(soon.getMonth() + 3);
    const today = new Date();
    return rows.map((r) => {
      const expiry = r.expiry_date ? new Date(r.expiry_date) : null;
      return {
        id: r.id, name: r.name, category: r.category ?? null,
        quantity: r.quantity, reorderLevel: r.reorder_level,
        unitPrice: Number(r.unit_price), expiryDate: r.expiry_date ?? null,
        lowStock: r.quantity < r.reorder_level,
        expired: !!expiry && expiry < today,
        expiringSoon: !!expiry && expiry >= today && expiry <= soon,
      };
    });
  }

  // ================= wards =================

  async wardBoard(): Promise<Ward[]> {
    const rows = unwrap(await this.db().from('ward_beds')
      .select('*, patients(full_name)').order('ward').order('bed_no')) as Row[];
    const byWard = new Map<string, Bed[]>();
    for (const r of rows) {
      const bed: Bed = {
        ward: r.ward, bedNo: r.bed_no, mrn: r.mrn ?? null,
        patientName: r.patients?.full_name ?? null, admittedAt: r.admitted_at ?? null,
      };
      byWard.set(r.ward, [...(byWard.get(r.ward) ?? []), bed]);
    }
    return [...byWard.entries()].map(([name, beds]) => ({
      name, beds, occupied: beds.filter((b) => b.mrn).length, total: beds.length,
    }));
  }

  async admit(mrn: string, ward: string, bedNo: string): Promise<void> {
    unwrap(await this.db().rpc('admit_patient', { p_mrn: mrn, p_ward: ward, p_bed: bedNo }));
  }

  /** Frees the bed and writes the summary in one transaction. */
  async discharge(ward: string, bedNo: string): Promise<void> {
    unwrap(await this.db().rpc('discharge_patient', { p_ward: ward, p_bed: bedNo }));
  }

  async medicationRound(): Promise<MarEntry[]> {
    const rows = unwrap(await this.db().rpc('medication_round')) as unknown as Row[];
    const now = Date.now();
    return (rows ?? []).map((r) => {
      const last = r.last_given_at ? new Date(r.last_given_at).getTime() : null;
      const interval = /twice/i.test(r.frequency) ? 12 : /three|thrice/i.test(r.frequency) ? 8 : 24;
      return {
        prescriptionId: r.prescription_id, mrn: r.mrn, patientName: r.patient_name,
        ward: r.ward, bedNo: r.bed_no, drug: r.drug, dose: r.dose,
        frequency: r.frequency, lastGivenAt: r.last_given_at ?? null,
        dueNow: last == null || now - last >= interval * 3600_000,
      };
    });
  }

  async recordAdministration(prescriptionId: number): Promise<void> {
    unwrap(await this.db().rpc('record_administration', { p_rx: prescriptionId }));
  }

  // ================= billing =================

  async invoices(): Promise<Invoice[]> {
    const rows = unwrap(await this.db().from('invoices')
      .select('*, patients(full_name), invoice_lines(*)')
      .order('created_at', { ascending: false })) as Row[];
    return rows.map(toInvoice);
  }

  async recordPayment(
    invoiceId: string, amount: number, method: 'cash' | 'momo', provider?: MomoProvider,
  ): Promise<void> {
    unwrap(await this.db().rpc('record_payment', {
      p_invoice: invoiceId, p_amount: amount, p_method: method, p_provider: provider ?? null,
    }));
  }

  async claims(): Promise<Claim[]> {
    const rows = unwrap(await this.db().from('claims')
      .select('*').order('updated_at', { ascending: false })) as Row[];
    return rows.map((r) => ({
      id: r.id, invoiceId: r.invoice_id, insurer: r.insurer,
      amount: Number(r.amount), status: r.status,
      justification: r.justification ?? null, updatedAt: r.updated_at,
    }));
  }

  /** Forward only. The trigger refuses anything else. */
  async advanceClaim(claimId: string): Promise<void> {
    unwrap(await this.db().rpc('advance_claim', { p_claim: claimId }));
  }

  // ================= admin =================

  async dashboardKpis(): Promise<Kpis> {
    const s = unwrap(await this.db().rpc('dashboard_kpis')) as unknown as Row;
    return {
      patientsTotal: s.patientsTotal, appointmentsToday: s.appointmentsToday,
      queueWaiting: s.queueWaiting, bedsOccupied: s.bedsOccupied, bedsTotal: s.bedsTotal,
      labsPending: s.labsPending, imagingPending: s.imagingPending, rxPending: s.rxPending,
      revenueCollected: Number(s.revenueCollected), revenueOutstanding: Number(s.revenueOutstanding),
      staffOnDuty: s.staffOnDuty, staffTotal: s.staffTotal, lowStockCount: s.lowStockCount,
    };
  }

  async liveActivity(limit: number): Promise<AuditEntry[]> {
    const rows = unwrap(await this.db().from('audit_entries')
      .select('*').order('occurred_at', { ascending: false }).limit(limit)) as Row[];
    return rows.map(toAudit);
  }

  async staffDirectory(): Promise<Staff[]> {
    const rows = unwrap(await this.db().from('staff').select('*').order('staff_no')) as Row[];
    return rows.map(toStaff);
  }

  /** Assembled server-side, then handed to the operations copilot. */
  async hospitalSnapshot(): Promise<OpsSnapshot> {
    const s = unwrap(await this.db().rpc('hospital_snapshot')) as unknown as Row;
    return {
      patientsTotal: s.patientsTotal,
      wards: s.wards ?? [],
      queueWaiting: s.queueWaiting, queueInTriage: s.queueInTriage,
      labsPending: s.labsPending, rxPending: s.rxPending,
      revenueCollected: Number(s.revenueCollected),
      revenueOutstanding: Number(s.revenueOutstanding),
      staffOnDuty: s.staffOnDuty, staffTotal: s.staffTotal,
      claims: s.claims,
    };
  }

  // ================= notifications =================

  async notifications(): Promise<AppNotification[]> {
    const rows = unwrap(await this.db().from('notifications')
      .select('*').order('created_at', { ascending: false }).limit(50)) as Row[];
    return rows.map((r) => ({
      id: r.id, mrn: r.mrn ?? null, staffId: r.staff_id ?? null, kind: r.kind,
      title: r.title, body: r.body ?? null, isRead: r.is_read, createdAt: r.created_at,
    }));
  }

  async markRead(id: number): Promise<void> {
    unwrap(await this.db().from('notifications')
      .update({ is_read: true }).eq('id', id).select('id').single());
  }
}
