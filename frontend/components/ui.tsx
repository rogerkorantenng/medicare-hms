import type { ReactNode } from 'react';

/** Material Symbols Rounded, always paired with a text label in navigation. */
export function Icon({
  name, className = '', filled = false, size = 18,
}: { name: string; className?: string; filled?: boolean; size?: number }) {
  return (
    <span
      className={`icon ${filled ? 'icon-fill' : ''} ${className}`}
      style={{ fontSize: size }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

/**
 * Avatars are generated as initials tiles rather than loading photographs.
 * One of the v1.0 deployment defects was an unreachable image source.
 */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-primary-bright text-white font-display font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'ai';

/** Colour AND word, always. */
export function Chip({ tone = 'neutral', children, icon }: {
  tone?: Tone; children: ReactNode; icon?: string;
}) {
  return (
    <span className={`chip-${tone}`}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  paid: 'success', completed: 'success', verified: 'success', dispensed: 'success',
  reported: 'success', confirmed: 'success', normal: 'success',
  part_paid: 'warning', pending: 'warning', processing: 'warning', scheduled: 'warning',
  collected: 'warning', checked_in: 'warning', authorised: 'warning', high: 'warning',
  low: 'warning', semi_urgent: 'warning',
  unpaid: 'danger', critical: 'danger', cancelled: 'danger', stat: 'danger', urgent: 'danger',
  ordered: 'info', submitted: 'info', resulted: 'info', scanned: 'info', routine: 'neutral',
};

const STATUS_WORD: Record<string, string> = {
  part_paid: 'Part paid', checked_in: 'Checked in', semi_urgent: 'Semi-urgent',
};

export function StatusChip({ value }: { value: string }) {
  const key = String(value).toLowerCase();
  const word = STATUS_WORD[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
  return <Chip tone={STATUS_TONE[key] ?? 'neutral'}>{word}</Chip>;
}

export function Card({ title, action, children, className = '' }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 mb-4">
          {typeof title === 'string' ? <h2 className="text-card">{title}</h2> : title}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-title">{title}</h1>
        {subtitle && <p className="text-support text-ink-soft mt-1">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ icon = 'inbox', title, hint }: {
  icon?: string; title: string; hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <span className="grid place-items-center w-12 h-12 rounded-full bg-primary-tint text-primary">
        <Icon name={icon} size={22} />
      </span>
      <p className="font-display font-bold">{title}</p>
      {hint && <p className="text-support text-ink-soft max-w-sm">{hint}</p>}
    </div>
  );
}

/**
 * A single figure.
 *
 * The label sits beside the icon rather than above the number, so the tile
 * is the height of its content instead of a fixed block with air in it.
 * Eight of these used to occupy a third of the dashboard while saying very
 * little; the same eight now fit in half the space and read faster.
 */
export function Stat({ label, value, hint, tone, icon }: {
  label: string; value: ReactNode; hint?: string; icon?: string;
  tone?: 'danger' | 'warning' | 'success';
}) {
  const toneClass = tone === 'danger' ? 'text-danger-fg'
    : tone === 'warning' ? 'text-warning-fg'
    : tone === 'success' ? 'text-success-fg' : 'text-ink';
  const iconTint = tone === 'danger' ? 'bg-danger-bg text-danger-fg'
    : tone === 'warning' ? 'bg-warning-bg text-warning-fg'
    : tone === 'success' ? 'bg-success-bg text-success-fg'
    : 'bg-primary-tint text-primary';

  return (
    <div className="card px-4 py-3.5 flex items-center gap-3">
      {icon && (
        <span className={`grid place-items-center w-9 h-9 rounded-control shrink-0 ${iconTint}`}>
          <Icon name={icon} size={19} />
        </span>
      )}
      <div className="min-w-0">
        <p className="label leading-none">{label}</p>
        <p className={`val text-xl font-bold mt-1 leading-none ${toneClass}`}>{value}</p>
        {hint && <p className="text-chip text-ink-soft mt-1">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * The restriction notice. A receptionist or cashier opening a chart sees this
 * instead of clinical data — and row-level security means the data was never
 * sent to the browser in the first place, so this is a explanation, not a
 * curtain.
 */
export function RestrictionNotice({ role }: { role: string }) {
  return (
    <div className="rounded-card border border-warning-br bg-warning-bg p-4 flex gap-3">
      <Icon name="lock" className="text-warning-fg mt-0.5" size={20} />
      <div>
        <p className="font-display font-bold text-warning-fg">Clinical detail is restricted</p>
        <p className="text-support text-warning-fg/90 mt-1">
          Your role ({role}) has access to demographic and billing information, not to
          consultations, vitals, results or prescriptions. This is enforced by the
          database, not by this screen.
        </p>
      </div>
    </div>
  );
}

/** All AI output renders in purple with a sparkle, never confusable with fact. */
export function AiPanel({ title = 'AI suggestion', children, footnote }: {
  title?: string; children: ReactNode; footnote?: string;
}) {
  return (
    <div className="ai-panel">
      <p className="flex items-center gap-1.5 font-display font-bold mb-2">
        <Icon name="auto_awesome" size={16} filled />
        {title}
      </p>
      <div className="text-body text-ink/90">{children}</div>
      {footnote && <p className="text-support mt-2 text-ai-fg/80">{footnote}</p>}
    </div>
  );
}

export function money(n: number) {
  return `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function when(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function onlyDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}
