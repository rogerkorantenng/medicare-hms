'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/ui';

/**
 * Search, filter and paging for the list screens.
 *
 * The patients list and the audit log had none of it: 28 records and 300
 * rows respectively, which is fine until it is five thousand, and the
 * SRS commits to five thousand.
 *
 * State lives in the query string rather than in React, so a filtered
 * view can be linked to, bookmarked, and reloaded without vanishing.
 */
export function ListFilter({ placeholder, choices, showPaging = true, total }: {
  placeholder: string;
  choices?: { param: string; label: string; options: [string, string][] }[];
  showPaging?: boolean;
  total?: number;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [text, setText] = useState(params.get('q') ?? '');

  const offset = Number(params.get('offset') ?? 0);
  const limit = Number(params.get('limit') ?? 50);

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    // Any change to the filter puts you back on the first page, because
    // page four of the old result set means nothing in the new one.
    if (!('offset' in changes)) next.delete('offset');
    router.push(`${path}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3 mb-5">
      <form
        className="flex gap-2 flex-1 min-w-[240px]"
        onSubmit={(e) => { e.preventDefault(); go({ q: text }); }}
      >
        <div className="field flex-1">
          <label htmlFor="q">Search</label>
          <input id="q" value={text} placeholder={placeholder}
                 onChange={(e) => setText(e.target.value)} />
        </div>
        <button className="btn-secondary self-end" type="submit">
          <Icon name="search" size={16} />Search
        </button>
      </form>

      {choices?.map((choice) => (
        <div className="field" key={choice.param}>
          <label htmlFor={choice.param}>{choice.label}</label>
          <select
            id={choice.param}
            value={params.get(choice.param) ?? ''}
            onChange={(e) => go({ [choice.param]: e.target.value })}
          >
            <option value="">Any</option>
            {choice.options.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      ))}

      {showPaging && (
        <div className="flex items-center gap-1.5 self-end ml-auto">
          <button className="btn-ghost" disabled={offset === 0}
                  onClick={() => go({ offset: String(Math.max(0, offset - limit)) })}>
            <Icon name="chevron_left" size={16} />Back
          </button>
          <span className="val text-support text-ink-soft px-1">
            {offset + 1}
            {typeof total === 'number' ? ` of ${total}` : ''}
          </span>
          <button className="btn-ghost"
                  disabled={typeof total === 'number' && offset + limit >= total}
                  onClick={() => go({ offset: String(offset + limit) })}>
            Next<Icon name="chevron_right" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
