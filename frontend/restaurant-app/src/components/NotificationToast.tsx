import { useNotifications } from '../context/NotificationContext';

export default function NotificationToast() {
  const { notifications, dismiss } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl bg-charcoal px-4 py-3 shadow-elevation-high"
        >
          <span className="font-body text-sm text-white">{notification.message}</span>
          <button
            type="button"
            onClick={() => dismiss(notification.id)}
            className="font-body text-xs font-medium text-white/70 hover:text-white"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
