import { useState, type FormEvent } from 'react';
import type { RestaurantDetailsInput } from '../api/restaurants';
import Button from './Button';
import TextField from './TextField';

interface RestaurantDetailsFormProps {
  initial?: RestaurantDetailsInput;
  submitLabel: string;
  busyLabel: string;
  /** Throws an Error whose message is shown to the owner on failure. */
  onSubmit: (input: RestaurantDetailsInput) => Promise<void>;
}

/** Name / address / cuisine / description, shared by registering and editing. */
export default function RestaurantDetailsForm({
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
}: RestaurantDetailsFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [cuisine, setCuisine] = useState(initial?.cuisine ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [errors, setErrors] = useState<{ name?: string; address?: string }>({});
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = {
      ...(name.trim() ? {} : { name: 'Name is required' }),
      ...(address.trim() ? {} : { address: 'Address is required' }),
    };
    setErrors(nextErrors);
    setFormError('');
    setSaved(false);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        address: address.trim(),
        cuisine: cuisine.trim() || null,
        description: description.trim() || null,
      });
      setSaved(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <TextField
        label="Name"
        name="name"
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />
      <TextField
        label="Address"
        name="address"
        value={address}
        maxLength={500}
        onChange={(e) => setAddress(e.target.value)}
        error={errors.address}
      />
      <TextField
        label="Cuisine (optional)"
        name="cuisine"
        value={cuisine}
        maxLength={100}
        placeholder="e.g. Italian"
        onChange={(e) => setCuisine(e.target.value)}
      />
      <TextField
        label="Description (optional)"
        name="description"
        value={description}
        maxLength={500}
        onChange={(e) => setDescription(e.target.value)}
      />
      {formError && (
        <p role="alert" className="font-body text-sm text-danger">
          {formError}
        </p>
      )}
      {saved && initial && (
        <p role="status" className="font-body text-sm text-success">
          Saved.
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? busyLabel : submitLabel}
      </Button>
    </form>
  );
}
