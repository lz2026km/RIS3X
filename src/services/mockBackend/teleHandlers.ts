// [G005 P1 W2-C] /api/v1/tele MSW handlers
// 对齐 backend modules/tele/tele.controller.ts (@Controller('tele')):
//   POST /tele/session · POST /tele/join · GET/DELETE /tele/session/:id
//   POST /tele/signal · GET /tele/signal/:sessionId?peer=
//   POST /tele/chat · GET /tele/chat/:sessionId?since=
//   POST /tele/cursor · GET /tele/cursor/:sessionId
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/tele';

const delayMs = (min = 30, max = 90) => Math.floor(Math.random() * (max - min) + min);

interface MockSession {
  id: string;
  hostId: string;
  hostName: string;
  guestId?: string;
  guestName?: string;
  studyUids: string[];
  status: 'waiting' | 'connected' | 'disconnected';
  createdAt: Date;
}

interface MockSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  from: string;
  to: string;
  sessionId: string;
  payload?: unknown;
}

interface MockChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

interface MockCursor {
  sessionId: string;
  userId: string;
  userName: string;
  x: number;
  y: number;
  color: string;
  timestamp: number;
}

const sessions = new Map<string, MockSession>();
const signals = new Map<string, MockSignal[]>();
const chat = new Map<string, MockChatMessage[]>();
const cursors = new Map<string, MockCursor[]>();

function pushTo<T>(map: Map<string, T[]>, key: string, item: T): void {
  const list = map.get(key) ?? [];
  list.push(item);
  map.set(key, list);
}

export const teleHandlers = [
  http.post(`${API}/session`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as { hostId?: string; hostName?: string; studyUids?: string[] };
    if (!body?.hostId || !body?.hostName) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'hostId/hostName required' } }, { status: 400 });
    }
    const session: MockSession = {
      id: `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      hostId: body.hostId,
      hostName: body.hostName,
      studyUids: Array.isArray(body.studyUids) ? body.studyUids : [],
      status: 'waiting',
      createdAt: new Date(),
    };
    sessions.set(session.id, session);
    return HttpResponse.json({ success: true, data: session }, { status: 201 });
  }),

  http.post(`${API}/join`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as { sessionId?: string; guestId?: string; guestName?: string };
    const session = body?.sessionId ? sessions.get(body.sessionId) : undefined;
    if (!session) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } }, { status: 404 });
    }
    if (session.guestId) {
      return HttpResponse.json({ success: false, error: { code: 'CONFLICT', message: 'Session already has a guest' } }, { status: 409 });
    }
    session.guestId = body?.guestId;
    session.guestName = body?.guestName;
    session.status = 'connected';
    return HttpResponse.json({ success: true, data: session });
  }),

  http.get(`${API}/session/:sessionId`, async ({ params }) => {
    await delay(delayMs(20, 60));
    const session = sessions.get(params.sessionId as string);
    if (!session) return HttpResponse.json({ success: true, data: { status: 'not_found' } });
    return HttpResponse.json({ success: true, data: session });
  }),

  http.delete(`${API}/session/:sessionId`, async ({ params }) => {
    await delay(delayMs());
    const id = params.sessionId as string;
    if (!sessions.has(id)) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } }, { status: 404 });
    }
    const session = sessions.get(id)!;
    session.status = 'disconnected';
    sessions.delete(id);
    signals.delete(id);
    chat.delete(id);
    cursors.delete(id);
    return HttpResponse.json({ success: true, data: { ok: true } });
  }),

  http.post(`${API}/signal`, async ({ request }) => {
    await delay(delayMs(20, 50));
    const body = (await request.json()) as MockSignal;
    if (!body?.sessionId || !body?.type || !body?.from || !body?.to) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'invalid signal payload' } }, { status: 400 });
    }
    pushTo(signals, body.sessionId, body);
    return HttpResponse.json({ success: true, data: { ok: true } });
  }),

  http.get(`${API}/signal/:sessionId`, async ({ params, request }) => {
    await delay(delayMs(20, 50));
    const sessionId = params.sessionId as string;
    const peer = new URL(request.url).searchParams.get('peer') ?? '';
    const all = signals.get(sessionId) ?? [];
    const filtered = peer ? all.filter((m) => m.to === peer) : all;
    signals.set(sessionId, all.filter((m) => !filtered.includes(m)));
    return HttpResponse.json({ success: true, data: filtered });
  }),

  http.post(`${API}/chat`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as { sessionId?: string; userId?: string; userName?: string; text?: string };
    if (!body?.sessionId || !body?.userId || !body?.text?.trim()) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'invalid chat payload' } }, { status: 400 });
    }
    const msg: MockChatMessage = {
      id: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      sessionId: body.sessionId,
      userId: body.userId,
      userName: body.userName ?? '',
      text: body.text,
      timestamp: new Date().toISOString(),
    };
    pushTo(chat, body.sessionId, msg);
    return HttpResponse.json({ success: true, data: msg }, { status: 201 });
  }),

  http.get(`${API}/chat/:sessionId`, async ({ params, request }) => {
    await delay(delayMs(20, 50));
    const sessionId = params.sessionId as string;
    const since = new URL(request.url).searchParams.get('since') ?? '';
    let all = chat.get(sessionId) ?? [];
    if (since) all = all.filter((m) => m.timestamp > since);
    else all = all.slice(-50);
    return HttpResponse.json({ success: true, data: all });
  }),

  http.post(`${API}/cursor`, async ({ request }) => {
    await delay(delayMs(10, 30));
    const body = (await request.json()) as MockCursor;
    if (!body?.sessionId || !body?.userId) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'invalid cursor payload' } }, { status: 400 });
    }
    const list = cursors.get(body.sessionId) ?? [];
    const idx = list.findIndex((c) => c.userId === body.userId);
    const pos: MockCursor = { ...body, timestamp: Date.now() };
    if (idx >= 0) list[idx] = pos;
    else list.push(pos);
    if (list.length > 20) list.splice(0, list.length - 20);
    cursors.set(body.sessionId, list);
    return HttpResponse.json({ success: true, data: { ok: true } });
  }),

  http.get(`${API}/cursor/:sessionId`, async ({ params }) => {
    await delay(delayMs(10, 30));
    const sessionId = params.sessionId as string;
    const now = Date.now();
    const all = (cursors.get(sessionId) ?? []).filter((c) => now - c.timestamp < 5000);
    return HttpResponse.json({ success: true, data: all });
  }),
];
