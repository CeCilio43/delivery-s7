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
import type { OrderStatus } from '../api/orders';
import { useAuth } from './AuthContext';

export interface Notification {
  id: string;
  message: string;
}

/** Pushed by notification-service when one of this user's orders changes. */
export interface OrderUpdate {
  orderId: string;
  status: OrderStatus;
  reason?: string;
}

type OrderUpdateListener = (update: OrderUpdate) => void;

interface NotificationContextValue {
  notifications: Notification[];
  dismiss: (id: string) => void;
  /** True while the websocket is open, i.e. order updates arrive live. */
  isConnected: boolean;
  /** Registers a listener for order updates; returns an unsubscribe function. */
  subscribeToOrderUpdates: (listener: OrderUpdateListener) => () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

interface OrderUpdatedMessage extends OrderUpdate {
  type: 'order.updated';
}

function isOrderUpdatedMessage(data: unknown): data is OrderUpdatedMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'order.updated' &&
    typeof (data as { orderId?: unknown }).orderId === 'string'
  );
}

function orderUpdateMessage(update: OrderUpdate): string {
  return update.status === 'CONFIRMED'
    ? 'Order confirmed: payment received, the restaurant has your order.'
    : `Order cancelled${update.reason ? `: ${update.reason}` : ''}.`;
}

// Browsers can't set headers on a WebSocket, so the gateway takes the JWT as
// a query parameter, verifies it and strips it before proxying.
function notificationSocketUrl(token: string): string {
  return `${API_GATEWAY_URL.replace(/^http/, 'ws')}/ws/notifications?token=${encodeURIComponent(token)}`;
}

const MAX_RECONNECT_DELAY_MS = 15000;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef(new Set<OrderUpdateListener>());

  const dismiss = useCallback((id: string) => {
    setNotifications((current) => current.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(
    (message: string) => {
      const id = crypto.randomUUID();
      setNotifications((current) => [...current, { id, message }]);
      setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );

  const subscribeToOrderUpdates = useCallback((listener: OrderUpdateListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  // The socket is per user: it only opens once logged in, and is replaced
  // whenever the token changes (log out / log in as someone else).
  const socketToken = isAuthenticated ? token : null;

  useEffect(() => {
    if (!socketToken) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let disposed = false;

    const connect = () => {
      socket = new WebSocket(notificationSocketUrl(socketToken));

      socket.onopen = () => {
        attempt = 0;
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const data: unknown = JSON.parse(event.data);
          if (isOrderUpdatedMessage(data)) {
            const update: OrderUpdate = {
              orderId: data.orderId,
              status: data.status,
              ...(data.reason ? { reason: data.reason } : {}),
            };
            notify(orderUpdateMessage(update));
            for (const listener of listenersRef.current) listener(update);
          }
        } catch {
          // Ignore malformed frames (e.g. the initial "connected" ack).
        }
      };

      // Reconnect with exponential backoff, e.g. when a service restarts.
      // Pages keep polling as a fallback while the socket is down.
      socket.onclose = () => {
        setIsConnected(false);
        if (disposed) return;
        const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      socket?.close();
      setIsConnected(false);
    };
  }, [socketToken, notify]);

  const value = useMemo<NotificationContextValue>(
    () => ({ notifications, dismiss, isConnected, subscribeToOrderUpdates }),
    [notifications, dismiss, isConnected, subscribeToOrderUpdates],
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

/** Calls `listener` whenever one of the current user's orders changes status. */
export function useOrderUpdates(listener: OrderUpdateListener): void {
  const { subscribeToOrderUpdates } = useNotifications();
  const listenerRef = useRef(listener);
  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);

  useEffect(
    () => subscribeToOrderUpdates((update) => listenerRef.current(update)),
    [subscribeToOrderUpdates],
  );
}
