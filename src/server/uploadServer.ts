import TcpSocket from 'react-native-tcp-socket';

import { UPLOAD_PAGE } from './uploadPage';

/**
 * A tiny HTTP server inside the app process, over a raw TCP socket — a TV has
 * no other way to expose a URL a phone can open. It speaks just enough
 * HTTP/1.1 for one page and one upload endpoint:
 *
 *   GET  /u/<code>   the upload page
 *   POST /u/<code>   request body is the CSV as text
 *
 * Everything else is 404. Responses are close-delimited (`Connection: close`
 * plus `end()`) so no Content-Length byte-counting can drift on multibyte
 * titles, and requests are parsed with the socket in binary encoding: one
 * char per byte, so `Content-Length` equals `string.length` exactly. The body
 * never needs to survive as real UTF-8 — the id column is ASCII, and the
 * `/^tt\d+$/` match cannot be reached by UTF-8 continuation bytes.
 *
 * The `<code>` is a random path segment per server start. Anyone on the same
 * Wi-Fi can reach the server — that is the point — but without the code there
 * is no page to load and no endpoint to post to.
 */

export type UploadOutcome = { ok: true; added: number; total: number } | { ok: false; error: string };

export type UploadServer = {
  /** The path the QR code points at: "/u/<code>". */
  path: string;
  port: number;
  stop: () => void;
};

const FIRST_PORT = 8477;
const PORT_ATTEMPTS = 20;
const MAX_BODY = 64 * 1024 * 1024;

function code6(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)];
  return s;
}

function respond(socket: TcpSocket.Socket, status: string, type: string, body: string): void {
  socket.write(
    `HTTP/1.1 ${status}\r\nContent-Type: ${type}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n`,
  );
  socket.write(body);
  // write→end back-to-back loses the buffered bytes on react-native-tcp-socket
  // (observed: every small JSON reply died, large HTML bodies survived). A short
  // delay lets the native side flush before the close.
  setTimeout(() => socket.end(), 50);
}

const json = (v: unknown) => JSON.stringify(v);

function handleRequest(
  socket: TcpSocket.Socket,
  req: { method: string; target: string; body: string; contentLength: number },
  path: string,
  onCsv: (csv: string) => Promise<UploadOutcome>,
): void {
  const { method, target, body, contentLength } = req;
  if (method !== 'GET' && method !== 'POST') {
    respond(socket, '405 Method Not Allowed', 'text/plain', 'no');
    return;
  }
  const route = target.split('?')[0];
  if (route !== path) {
    respond(socket, '404 Not Found', 'text/plain', 'not found');
    return;
  }
  if (method === 'GET') {
    respond(socket, '200 OK', 'text/html; charset=utf-8', UPLOAD_PAGE);
    return;
  }
  if (contentLength < 0) {
    respond(socket, '411 Length Required', 'application/json', json({ ok: false, error: 'no content length' }));
    return;
  }
  onCsv(body.slice(0, contentLength))
    .then((outcome) =>
      respond(socket, outcome.ok ? '200 OK' : '422 Unprocessable Content', 'application/json', json(outcome)),
    )
    .catch((e) =>
      respond(socket, '500 Internal Server Error', 'application/json', json({ ok: false, error: String(e) })),
    );
}

function handleConnection(
  socket: TcpSocket.Socket,
  path: string,
  onCsv: (csv: string) => Promise<UploadOutcome>,
): void {
  socket.setEncoding('binary');
  let head = '';
  let body = '';
  let inBody = false;
  let contentLength = -1;
  let method = '';
  let target = '';

  socket.on('error', () => socket.destroy());
  socket.on('data', (chunk: string | Uint8Array) => {
    // setEncoding above makes this the string path; the byte path is a latin1
    // decode, one char per byte, so Content-Length arithmetic still holds
    let data = '';
    if (typeof chunk === 'string') data = chunk;
    else for (const b of chunk) data += String.fromCharCode(b);
    if (!inBody) {
      head += data;
      const split = head.indexOf('\r\n\r\n');
      if (split === -1) {
        if (head.length > 32 * 1024) socket.destroy();
        return;
      }
      const lines = head.slice(0, split).split('\r\n');
      [method, target] = lines[0].split(' ');
      for (const line of lines.slice(1)) {
        const [name, value] = line.split(/:\s*/);
        if (name.toLowerCase() === 'content-length') contentLength = Number(value);
      }
      body = head.slice(split + 4);
      inBody = true;
    } else {
      body += data;
    }
    if (method === 'POST') {
      if (contentLength > MAX_BODY) {
        respond(socket, '413 Payload Too Large', 'application/json', json({ ok: false, error: 'file too large' }));
        return;
      }
      if (contentLength < 0 || body.length < contentLength) return;
    }
    // everything for this request is in; the socket is closed in the response
    handleRequest(socket, { method, target, body, contentLength }, path, onCsv);
  });
}

export function startUploadServer(
  onCsv: (csv: string) => Promise<UploadOutcome>,
): Promise<UploadServer> {
  const path = `/u/${code6()}`;

  return new Promise((resolve, reject) => {
    const tryListen = (attempt: number) => {
      const port = FIRST_PORT + attempt;
      const server = TcpSocket.createServer((socket) => handleConnection(socket, path, onCsv));
      server.on('error', () => {
        if (attempt + 1 < PORT_ATTEMPTS) tryListen(attempt + 1);
        else reject(new Error('no free port for the upload server'));
      });
      server.listen({ port, host: '0.0.0.0' }, () => resolve({ path, port, stop: () => server.close() }));
    };
    tryListen(0);
  });
}
