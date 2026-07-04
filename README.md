# Credit

Project ini fork dari 9Router WYx0 oleh Wisyam: https://github.com/Wisyam/9router_wyx0

# GDRouter

GDRouter adalah fork lokal 9Router/WYx09r untuk routing AI provider lewat API kompatibel OpenAI.

Versi: `v0.5.10-gdr0.1`

## Fitur Utama

- OpenAI-compatible endpoint: `http://localhost:20128/v1`
- Dashboard lokal: `http://localhost:20128/dashboard`
- Routing provider chat, image, embedding, TTS, STT, dan web search
- RTK token compression untuk tool output
- Quota tracking, fallback provider, multi-account provider
- CLI lokal: `gdrouter`

## Kebutuhan

- Node.js `>=18`
- npm

## Running Development

Install dependency:

```bash
npm install
```

Jalankan dev server:

```bash
npm run dev
```

Dev server berjalan di:

```text
http://localhost:20128
```

Dashboard:

```text
http://localhost:20128/dashboard
```

API endpoint:

```text
http://localhost:20128/v1
```

Run dengan env eksplisit:

```bash
PORT=20128 NEXT_PUBLIC_BASE_URL=http://localhost:20128 npm run dev
```

## Running Production Local

Build app:

```bash
npm run build
```

Start standalone server:

```bash
PORT=20128 HOSTNAME=0.0.0.0 NEXT_PUBLIC_BASE_URL=http://localhost:20128 npm run start
```

## CLI Development

Build dan pack CLI lokal:

```bash
npm run cli:pack
```

Install package hasil pack:

```bash
npm install -g ./gdrouter-*.tgz
```

Jalankan CLI:

```bash
gdrouter --skip-update
```

Gunakan `--skip-update` untuk build fork lokal supaya CLI tidak mencoba update ke package upstream.

## CLI Package

Package CLI berada di `cli/`.

Command utama:

```bash
gdrouter
```

Development CLI langsung dari source:

```bash
npm --prefix cli run dev
```

Build CLI:

```bash
npm --prefix cli run build
```

Pack CLI:

```bash
npm --prefix cli run pack:cli
```

## Konfigurasi Client AI

Pakai nilai ini di Claude Code, Codex, OpenCode, Cursor, Cline, atau tool lain yang mendukung OpenAI-compatible API:

```text
Base URL: http://localhost:20128/v1
API Key: copy dari dashboard GDRouter
Model: pilih model dari dashboard/provider registry
```

## Test

Run semua test dari folder `tests`:

```bash
cd tests
npx vitest run --config ./vitest.config.js
```

Run translator test:

```bash
cd tests
npx vitest run --config ./vitest.config.js "tests/translator/"
```

## Struktur Penting

- `src/app/` - Next.js App Router dashboard dan API routes
- `open-sse/` - routing engine, executors, translators, provider registry
- `cli/` - package CLI `gdrouter`
- `tests/` - Vitest suite
- `public/providers/` - asset provider

## Versioning

Versi aktif project:

```text
v0.5.10-gdr0.1
```

Package version:

```text
0.5.10-gdr0.1
```
