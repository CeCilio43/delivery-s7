import type { ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-divider px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-elevation-high">
        <h1 className="font-display text-[28px] font-semibold text-charcoal">{title}</h1>
        {subtitle && <p className="mt-2 font-body text-sm text-muted">{subtitle}</p>}
        <div className="mt-8 flex flex-col gap-6">{children}</div>
        {footer && <div className="mt-6 text-center font-body text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}
