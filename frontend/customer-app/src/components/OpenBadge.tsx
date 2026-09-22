interface OpenBadgeProps {
  isOpen: boolean;
}

export default function OpenBadge({ isOpen }: OpenBadgeProps) {
  return (
    <span
      className={`shrink-0 rounded-2xl px-3 py-1 font-body text-xs font-medium ${
        isOpen ? 'bg-success/10 text-success' : 'bg-divider text-muted'
      }`}
    >
      {isOpen ? 'Open' : 'Closed'}
    </span>
  );
}
