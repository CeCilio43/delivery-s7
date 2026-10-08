import type { ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-panel p-8 shadow-elevation-high">
        <span className="rounded-2xl bg-brand-tint px-3 py-1 font-body text-xs font-medium text-brand">
          Restaurant
        </span>
        <h1 className="mt-4 font-display text-[28px] font-semibold text-charcoal">{title}</h1>
        {subtitle && <p className="mt-2 font-body text-sm text-muted">{subtitle}</p>}
        <div className="mt-8 flex flex-col gap-6">{children}</div>
        {footer && <div className="mt-6 text-center font-body text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}
