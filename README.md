# ZenYC Public API Mini (Zendesk Sidebar App)

A Zendesk ticket sidebar app (ZAF v2 + React + Vite). It reads ticket data, fetches a customer via a public API, shows the last 3 posts, and generates a reply draft with Copy, Regenerate, and Refresh actions.

## Features
- ZAF v2: reads `ticket.requester.email`, `ticket.subject`, `ticket.description`
- Public APIs (CORS):
  - `GET https://jsonplaceholder.typicode.com/users?email=`
  - `GET https://jsonplaceholder.typicode.com/posts?userId=`
- States: loading skeleton, not found, and error with Retry
- Reply draft: JS template with tone selector (Friendly / Concise)
- Buttons: Regenerate, Copy to Clipboard, Refresh Data

## Run locally (dev)

```bash
npm install
npm run dev
```

- In dev (outside Zendesk), the app falls back to URL params for ticket data.
- Example: `http://localhost:5173/?email=Sincere@april.biz&subject=Hello&description=Test`.

## Build for Zendesk

```bash
npm run build
```

- Output: `app/assets/` including `index.html` and bundled assets.
- Manifest: `app/manifest.json` with `assets/index.html` as the ticket sidebar URL.
- Package/upload the `app/` folder to Zendesk Admin > Apps > Manage.

## Notes
- ZAF SDK is loaded via a script tag in `index.html`.
- When inside Zendesk, the app uses `ZAFClient.init()` and `client.get([...])` to read ticket fields.
- Uses JSONPlaceholder public endpoints without auth.