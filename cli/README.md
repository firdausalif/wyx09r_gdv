# GDRouter CLI

CLI package untuk menjalankan server GDRouter lokal.

Version: `v0.5.18-gdr0.1`

## Command

```bash
gdrouter
```

## Install Dari Source Pack

Dari root repository:

```bash
npm run cli:pack
npm install -g ./gdrouter-*.tgz
gdrouter --skip-update
```

## Development

Dari root repository:

```bash
npm --prefix cli install
npm --prefix cli run dev
```

## Build

```bash
npm --prefix cli run build
```

## Pack

```bash
npm --prefix cli run pack:cli
```

## Publish

```bash
npm --prefix cli run publish:cli
```

## Opsi Umum

```bash
gdrouter --port 8080
gdrouter --no-browser
gdrouter --skip-update
gdrouter --help
```

## Endpoint Default

```text
Dashboard: http://localhost:20128/dashboard
API: http://localhost:20128/v1
```
