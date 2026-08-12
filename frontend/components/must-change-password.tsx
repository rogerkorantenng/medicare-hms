import Link from 'next/link';
import { Icon } from '@/components/ui';

/**
 * Shown while somebody is still using a password an administrator typed
 * for them.
 *
 * A temporary password is known to at least two people by definition, so
 * it is a credential in name only. The flag clears itself the moment
 * they set their own.
 */
export function MustChangePassword({ href }: { href: string }) {
  return (
    <div className="no-print mb-5 rounded-card border border-warning-br bg-warning-bg px-4 py-3 flex flex-wrap items-center gap-3">
      <Icon name="lock" size={19} className="text-warning-fg" />
      <p className="text-support text-warning-fg flex-1 min-w-[220px]">
        You are still using the password you were given. Somebody else knows
        it, so it is not really yours yet.
      </p>
      <Link href={href} className="btn-primary">
        <Icon name="lock" size={16} />Choose your own
      </Link>
    </div>
  );
}
