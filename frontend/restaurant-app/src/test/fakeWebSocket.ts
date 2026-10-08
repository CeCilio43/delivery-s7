import { act } from '@testing-library/react';

/**
 * Minimal stand-in for the browser WebSocket, covering what
 * NotificationContext uses. Tests open it and push messages through it.
 */
export class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  url: string;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  /** The most recently opened socket. */
  static latest(): FakeWebSocket {
    const socket = FakeWebSocket.instances.at(-1);
    if (!socket) throw new Error('No websocket has been opened');
    return socket;
  }

  open() {
    act(() => this.onopen?.());
  }

  push(message: object) {
    act(() => this.onmessage?.({ data: JSON.stringify(message) }));
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }
}
