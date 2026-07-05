import net from "node:net";
import http from "node:http";

// Chromium (and therefore Playwright/CloakBrowser/Camoufox) does NOT support
// SOCKS5 proxy authentication. The `proxy.username` / `proxy.password` fields
// in Playwright's launch options only work for HTTP proxies. When you pass a
// socks5://user:pass@host:port URL, Chromium throws
// `net::ERR_NO_SUPPORTED_PROXIES` on the first navigation.
//
// This module spawns a local HTTP proxy (on 127.0.0.1) that:
//   1. Accepts unauthenticated CONNECT requests from the browser.
//   2. For each CONNECT, performs a SOCKS5 handshake to the real upstream
//      proxy WITH authentication.
//   3. Pipes bytes between the browser socket and the SOCKS5 connection.
//
// The browser then uses `http://127.0.0.1:<port>` (no auth) as its proxy,
// and the upstream SOCKS5 auth is handled transparently by this bridge.
//
// Lifecycle:
//   const bridge = await createSocksAuthBridge("socks5://user:pass@host:1080");
//   // bridge.port, bridge.localUrl ("http://127.0.0.1:<port>")
//   // ... launch browser with proxy { server: bridge.localUrl } ...
//   await bridge.close();   // when browser closes

const DEFAULT_BRIDGE_HOST = "127.0.0.1";

function parseSocksUrl(proxyUrl) {
  let parsed;
  try {
    parsed = new URL(proxyUrl);
  } catch {
    return null;
  }
  const proto = parsed.protocol.toLowerCase();
  if (proto !== "socks5:" && proto !== "socks5h:" && proto !== "socks4:" && proto !== "socks4a:") {
    return null;
  }
  if (!parsed.hostname || !parsed.port) return null;
  return {
    protocol: proto,
    host: parsed.hostname,
    port: parseInt(parsed.port, 10),
    username: parsed.username ? decodeURIComponent(parsed.username) : null,
    password: parsed.password ? decodeURIComponent(parsed.password) : null,
  };
}

function needsBridge(proxyUrl) {
  const info = parseSocksUrl(proxyUrl);
  if (!info) return false;
  // Only SOCKS proxies WITH auth need the bridge. SOCKS without auth works
  // natively in Chromium via `proxy.server`.
  return Boolean(info.username || info.password);
}

function pickFreePort(host = DEFAULT_BRIDGE_HOST) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, host, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function connectViaSocks(targetHost, targetPort, socksInfo) {
  const socks = await import("socks");
  const SocksClient = socks.SocksClient || socks.default?.SocksClient;
  if (!SocksClient) {
    throw new Error("socks package did not expose SocksClient");
  }

  const options = {
    proxy: {
      host: socksInfo.host,
      port: socksInfo.port,
      type: socksInfo.protocol.startsWith("socks4") ? 4 : 5,
      userId: socksInfo.username || undefined,
      password: socksInfo.password || undefined,
    },
    command: "connect",
    destination: { host: targetHost, port: targetPort },
    timeout: 30_000,
  };

  const { socket } = await SocksClient.createConnection(options);
  return socket;
}

function parseConnectHost(url) {
  // For CONNECT requests, Node's HTTP server gives req.url as "host:port"
  // (no scheme, no CONNECT prefix). For plain HTTP proxy requests, req.url
  // is an absolute URL like "http://host:port/path".
  const direct = /^([^\s:]+):(\d+)$/.exec(url || "");
  if (direct) return { host: direct[1], port: parseInt(direct[2], 10) };
  try {
    const parsed = new URL(url || "");
    if (parsed.hostname && parsed.port) {
      return { host: parsed.hostname, port: parseInt(parsed.port, 10) };
    }
  } catch {
    // not a URL
  }
  return null;
}

/**
 * Create a local HTTP CONNECT proxy that bridges to a SOCKS5 upstream with
 * authentication. Returns { port, localUrl, close }.
 *
 * The bridge stays alive until close() is called. It is unauthenticated
 * (bound to 127.0.0.1) so only local processes can use it.
 */
export async function createSocksAuthBridge(proxyUrl) {
  const socksInfo = parseSocksUrl(proxyUrl);
  if (!socksInfo) {
    throw new Error(`Not a SOCKS proxy URL: ${proxyUrl}`);
  }
  if (!socksInfo.username && !socksInfo.password) {
    throw new Error("SOCKS proxy has no auth — bridge not needed");
  }

  const port = await pickFreePort();
  const server = http.createServer();

  // Handle CONNECT (HTTPS tunneling). The browser sends:
  //   CONNECT target.example.com:443 HTTP/1.1
  // We SOCKS5-connect to the target via the upstream proxy, then pipe.
  server.on("connect", (req, clientSocket, head) => {
    // For CONNECT requests, req.url is "host:port" (no scheme).
    const target = parseConnectHost(req.url || "");
    if (!target) {
      clientSocket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      clientSocket.end();
      return;
    }

    connectViaSocks(target.host, target.port, socksInfo)
      .then((upstreamSocket) => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head && head.length) upstreamSocket.write(head);

        upstreamSocket.on("error", () => clientSocket.destroy());
        clientSocket.on("error", () => upstreamSocket.destroy());

        upstreamSocket.pipe(clientSocket);
        clientSocket.pipe(upstreamSocket);

        const cleanup = () => {
          upstreamSocket.destroy();
          clientSocket.destroy();
        };
        upstreamSocket.on("close", cleanup);
        clientSocket.on("close", cleanup);
      })
      .catch((err) => {
        clientSocket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
        clientSocket.end();
      });
  });

  // Also handle plain HTTP requests (non-CONNECT) by forwarding via SOCKS.
  // Most automation traffic is HTTPS (CONNECT), but some HTTP pages may use
  // direct GET/POST through the proxy.
  server.on("request", (req, res) => {
    // Absolute-URI request: GET http://example.com/path HTTP/1.1
    const reqUrl = req.url || "";
    let target;
    try {
      target = new URL(reqUrl);
    } catch {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }

    connectViaSocks(target.hostname, parseInt(target.port || "80", 10), socksInfo)
      .then((upstreamSocket) => {
        const reqLines = [
          `${req.method} ${target.pathname}${target.search} HTTP/1.1`,
          `Host: ${target.host}`,
        ];
        for (const [key, value] of Object.entries(req.headers)) {
          if (key.toLowerCase() === "proxy-connection") continue;
          reqLines.push(`${key}: ${value}`);
        }
        reqLines.push("", "");
        upstreamSocket.write(reqLines.join("\r\n"));
        req.pipe(upstreamSocket);

        upstreamSocket.pipe(res.socket);
        upstreamSocket.on("error", () => res.destroy());
        res.socket.on("error", () => upstreamSocket.destroy());
        upstreamSocket.on("close", () => res.end());
      })
      .catch(() => {
        res.writeHead(502);
        res.end("Bad gateway");
      });
  });

  await new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, DEFAULT_BRIDGE_HOST, resolve);
  });

  const localUrl = `http://${DEFAULT_BRIDGE_HOST}:${port}`;
  let closed = false;

  return {
    port,
    localUrl,
    async close() {
      if (closed) return;
      closed = true;
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

export { needsBridge, parseSocksUrl };
