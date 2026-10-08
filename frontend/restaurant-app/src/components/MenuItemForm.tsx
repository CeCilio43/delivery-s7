import { useState, type FormEvent } from 'react';
import type { MenuItemInput } from '../api/restaurants';

interface MenuItemFormProps {
  initial?: { name: string; description: string | null; price: string };
  submitLabel: string;
  busyLabel: string;
  onSubmit: (input: MenuItemInput) => Promise<void>;
  onCancel?: () => void;
}

const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Name / description / price fields, shared by adding and editing an item. */
export default function MenuItemForm({ initial, submitLabel, busyLabel, onSubmit, onCancel }: MenuItemFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial ? Number(initial.price).toFixed(2) : '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedPrice = price.trim().replace(',', '.');
    if (!name.trim()) return setError('Name is required');
    if (!PRICE_PATTERN.test(trimmedPrice) || Number(trimmedPrice) <= 0) {
      return setError('Enter a price like 12.50');
    }

    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        price: Number(trimmedPrice),
      });
      if (!initial) {
        setName('');
        setDescription('');
        setPrice('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    'rounded-2xl border border-divider bg-canvas px-3 py-2 font-body text-sm text-charcoal outline-none focus:border-brand';

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="flex flex-col gap-1 font-body text-xs text-charcoal">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 font-body text-xs text-charcoal">
          Price
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="12.50"
            className={inputClass}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 font-body text-xs text-charcoal">
        Description (optional)
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          className={inputClass}
        />
      </label>
      {error && (
        <p role="alert" className="font-body text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-2xl bg-brand px-4 py-2 font-display text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {isSubmitting ? busyLabel : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl px-4 py-2 font-display text-sm font-medium text-muted hover:text-charcoal"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
