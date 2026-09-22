import type { InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export default function TextField({
  label,
  error,
  id,
  name,
  className = '',
  ...props
}: TextFieldProps) {
  const inputId = id ?? name;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="font-body text-sm text-charcoal">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        className={`rounded-2xl border px-4 py-4 font-body text-sm text-charcoal outline-none transition-colors focus:border-brand ${
          error ? 'border-danger' : 'border-divider'
        } ${className}`}
        {...props}
      />
      {error && <p className="font-body text-xs text-danger">{error}</p>}
    </div>
  );
}
