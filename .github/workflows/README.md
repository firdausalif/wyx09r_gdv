# GitHub Workflows

## discord-announce.yml

Auto-posts a release announcement to a Discord channel each time the
`version` field in `package.json` changes on `master`.

### Setup

1. In your Discord server, create a webhook for the channel that should
   receive announcements:
   - Channel settings → Integrations → Webhooks → New Webhook
   - Copy the webhook URL.
2. In GitHub, add the URL as a repository secret:
   - Repo settings → Secrets and variables → Actions → New repository secret
   - Name: `DISCORD_WEBHOOK_URL`
   - Value: the full Discord webhook URL.
3. Push a commit that bumps `package.json#version`. The workflow runs,
   reads the matching `# vX.Y.Z` section from `CHANGELOG.md`, formats it
   into the project's announcement template, and POSTs it to the webhook.

### Output format

```
@everyone
## <TYPE> UPDATE v<VERSION>
[NEW]
- ...
[FIX]
- ...
[IMPROVEMENT]
- ...

run ```npm update -g wyxrouter```
```

`<TYPE>` is `MAJOR UPDATE` / `FEATURE UPDATE` / `HOTFIX UPDATE` /
`PATCH UPDATE`, picked from the version bump shape and CHANGELOG content.

### Local preview

```
node scripts/discord-announce.mjs 0.4.85
```

The script writes `discord-payload.json` next to `CHANGELOG.md` and prints
the rendered Discord content. Re-run with a different version argument to
preview different sections.

### Skipping a release

If you bump the version but don't want to announce (e.g. internal-only
fix), revert the workflow run by deleting the `DISCORD_WEBHOOK_URL` secret
temporarily, OR push a commit that leaves the version untouched (the
workflow only fires when the version actually changes).
