import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { FakeWebSocket } from './fakeWebSocket';

// NotificationProvider opens a websocket on login; tests drive it by hand
// instead of reaching for a real server.
vi.stubGlobal('WebSocket', FakeWebSocket);

// Vitest runs without globals, so Testing Library can't register its own
// automatic cleanup; unmount rendered trees and reset state here instead.
afterEach(() => {
  cleanup();
  localStorage.clear();
  FakeWebSocket.instances = [];
});
