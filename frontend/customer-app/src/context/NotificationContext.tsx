import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { API_GATEWAY_URL } from '../api/client';

export interface Notification {
  id: string;
  message: string;
}

interface NotificationContextValue {
  notifications: Notification[];
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

interface HelloWorldEvent {
  type: 'notification';
  event: 'hello.world';
  payload: { message: string };
}

function isHelloWorldEvent(data: unknown): data is HelloWorldEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'notification' &&
    (data as { event?: unknown }).event === 'hello.world'
  );
}

function notificationSocketUrl(): string {
  return `${API_GATEWAY_URL.replace(/^http/, 'ws')}/ws/notifications`;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  const dismiss = useCallback((id: string) => {
    setNotifications((current) => current.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    // Connects once for the lifetime of the app; the backend broadcasts to
    // every connected client, so this is a demo-friendly stand-in for a
    // per-user notification feed.
    const socket = new WebSocket(notificationSocketUrl());
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const data: unknown = JSON.parse(event.data);
        if (isHelloWorldEvent(data)) {
          const id = crypto.randomUUID();
          setNotifications((current) => [...current, { id, message: data.payload.message }]);
          setTimeout(() => dismiss(id), 6000);
        }
      } catch {
        // Ignore malformed frames (e.g. the initial "connected" ack).
      }
    };

    return () => socket.close();
  }, [dismiss]);

  const value = useMemo<NotificationContextValue>(
    () => ({ notifications, dismiss }),
    [notifications, dismiss],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
