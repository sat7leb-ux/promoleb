import { redirect } from 'next/navigation';
import { LogoLockup } from '@/components/shared/logo';

/**
 * Auth shell: split layout with the brand panel on large screens and a plain
 * centred card on mobile.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — hidden below lg so mobile users get the form immediately. */}
      <aside className="relative hidden overflow-hidden bg-brand-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #1a44f5 0%, transparent 45%), radial-gradient(circle at 80% 70%, #eeb03c 0%, transparent 40%)',
          }}
          aria-hidden
        />

        <div className="relative">
          <div className="inline-flex rounded-xl bg-white/10 p-3 backdrop-blur">
            <LogoLockup />
          </div>
        </div>

        <div className="relative max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
            Every promo request, from idea to delivery.
          </h2>
          <p className="text-sm leading-relaxed text-brand-100/80">
            One place to request, plan, assign and track promotional work across every
            SAT-7 channel — with shifts, participants, deadlines and full audit history.
          </p>

          <dl className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
            {[
              ['Shifts', 'Tracked per request'],
              ['People', 'Assigned and participating'],
              ['Reports', 'By channel, program, user'],
            ].map(([term, desc]) => (
              <div key={term}>
                <dt className="text-sm font-semibold text-white">{term}</dt>
                <dd className="mt-0.5 text-xs leading-snug text-brand-100/70">{desc}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-xs text-brand-100/50">
          Internal system · Authorised SAT-7 staff only
        </p>
      </aside>

      <main className="flex flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="lg:hidden">
            <LogoLockup />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

/** Signed-in users should never see an auth screen. */
export async function requireSignedOut() {
  const { getCurrentUser } = await import('@/lib/auth/session');
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');
}