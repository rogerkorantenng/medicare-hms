'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { registerPatientAction } from '@/app/actions';
import { useToast } from '@/components/shell/shell';
import { Card, Icon } from '@/components/ui';
import type { Patient } from '@/lib/repository/types';

const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const INSURERS = ['NHIS', 'BlueShield HMO', 'Medicare', 'Aetna PPO', 'Self-pay'];
const COMMON_ALLERGIES = ['Penicillin', 'Sulfa', 'NSAID', 'Pollen', 'Latex', 'Peanuts'];
const COMMON_CONDITIONS = ['Hypertension', 'Type 2 Diabetes', 'Asthma', 'Migraine', 'Hyperlipidaemia'];

export function RegisterForm() {
  const [f, setF] = useState({
    fullName: '', age: '', sex: 'F' as 'M' | 'F', phone: '',
    bloodGroup: '', insurance: 'NHIS',
  });
  const [allergies, setAllergies] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [saved, setSaved] = useState<Patient | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await registerPatientAction({
        fullName: f.fullName.trim(),
        age: Number(f.age),
        sex: f.sex,
        phone: f.phone.trim(),
        bloodGroup: f.bloodGroup || null,
        allergies, conditions,
        insurance: f.insurance || null,
      });
      toast(r.message, r.ok ? 'ok' : 'error');
      if (r.ok) {
        setSaved(r.data as Patient);
        setF({ fullName: '', age: '', sex: 'F', phone: '', bloodGroup: '', insurance: 'NHIS' });
        setAllergies([]); setConditions([]);
      }
    });
  }

  if (saved) {
    return (
      <Card className="max-w-lg">
        <div className="text-center py-4">
          <span className="grid place-items-center w-14 h-14 mx-auto rounded-full bg-success-bg text-success-fg">
            <Icon name="check_circle" size={28} filled />
          </span>
          <h2 className="text-section mt-3">{saved.fullName} is registered</h2>
          <p className="text-support text-ink-soft mt-1">Medical record number allocated by the database:</p>
          <p className="val text-2xl font-bold text-primary mt-2">{saved.mrn}</p>

          <div className="flex gap-2 mt-6">
            <button className="btn-ghost flex-1" onClick={() => setSaved(null)}>Register another</button>
            <Link href={`/workspace/patients/${saved.mrn}`} className="btn-primary flex-1">Open chart</Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-2xl">
      <Card>
        <div className="grid sm:grid-cols-2 gap-3.5">
          <div className="field sm:col-span-2">
            <label htmlFor="name">Full name</label>
            <input id="name" required value={f.fullName}
                   onChange={(e) => setF({ ...f, fullName: e.target.value })} placeholder="Given name and surname" />
          </div>

          <div className="field">
            <label htmlFor="age">Age</label>
            <input id="age" required type="number" min={0} max={129} className="val" value={f.age}
                   onChange={(e) => setF({ ...f, age: e.target.value })} placeholder="34" />
          </div>

          <div className="field">
            <label htmlFor="sex">Sex</label>
            <select id="sex" value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value as 'M' | 'F' })}>
              <option value="F">Female</option>
              <option value="M">Male</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" required className="val" value={f.phone}
                   onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+233 (24) 000-0000" />
          </div>

          <div className="field">
            <label htmlFor="bg">Blood group</label>
            <select id="bg" value={f.bloodGroup} onChange={(e) => setF({ ...f, bloodGroup: e.target.value })}>
              <option value="">Not known</option>
              {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>

          <div className="field sm:col-span-2">
            <label htmlFor="ins">Insurance</label>
            <select id="ins" value={f.insurance} onChange={(e) => setF({ ...f, insurance: e.target.value })}>
              {INSURERS.map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>

          <fieldset className="sm:col-span-2">
            <legend className="label mb-2">Allergies</legend>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_ALLERGIES.map((a) => (
                <button key={a} type="button" onClick={() => toggle(allergies, setAllergies, a)}
                        className={allergies.includes(a) ? 'chip-danger' : 'chip-neutral'}>
                  {allergies.includes(a) && <Icon name="check" size={13} />}{a}
                </button>
              ))}
            </div>
            <p className="text-support text-ink-soft mt-2">
              These drive the prescription safety check, which cannot be overridden from a screen.
            </p>
          </fieldset>

          <fieldset className="sm:col-span-2">
            <legend className="label mb-2">Known conditions</legend>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_CONDITIONS.map((c) => (
                <button key={c} type="button" onClick={() => toggle(conditions, setConditions, c)}
                        className={conditions.includes(c) ? 'chip-info' : 'chip-neutral'}>
                  {conditions.includes(c) && <Icon name="check" size={13} />}{c}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <button className="btn-primary w-full mt-6 py-2.5" disabled={pending}>
          {pending ? <Icon name="progress_activity" className="animate-spin" size={18} /> : <Icon name="person_add" size={18} />}
          Register and allocate MRN
        </button>
      </Card>
    </form>
  );
}
