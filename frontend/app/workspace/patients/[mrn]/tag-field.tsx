'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui';

/**
 * A list of short free-text values, entered one at a time. Enter commits,
 * so a nurse recording three allergies never reaches for the mouse.
 */
export function TagField({ label, tone, values, placeholder, onAdd, onRemove }: {
  label: string;
  tone: 'danger' | 'info';
  values: string[];
  placeholder: string;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [draft, setDraft] = useState('');

  function commit() { onAdd(draft); setDraft(''); }

  return (
    <div className="mt-5">
      <p className="label mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5 mb-2.5 min-h-[28px]">
        {values.length === 0
          ? <span className="text-support text-ink-faint">None recorded.</span>
          : values.map((value) => (
            <span key={value} className={`chip-${tone} pr-1`}>
              {value}
              <button type="button" aria-label={`Remove ${value}`}
                      className="ml-0.5 opacity-70 hover:opacity-100"
                      onClick={() => onRemove(value)}>
                <Icon name="close" size={14} />
              </button>
            </span>
          ))}
      </div>
      <div className="flex gap-2">
        <input value={draft} placeholder={placeholder} className="flex-1"
               onChange={(e) => setDraft(e.target.value)}
               onKeyDown={(e) => {
                 if (e.key === 'Enter') { e.preventDefault(); commit(); }
               }} />
        <button type="button" className="btn-secondary" onClick={commit}>
          <Icon name="add" size={16} />Add
        </button>
      </div>
    </div>
  );
}
