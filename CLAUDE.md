# homebridge-volvo-ev

A Homebridge platform plugin that exposes a Volvo EV's connected vehicle data to Apple HomeKit using the Volvo Connected Vehicle API v2.

---

## Design Decisions

- **Vehicle type**: EV (no fuel/ICE endpoints)
- **Architecture**: Option B — multiple independent accessories (one per capability), not one monolithic accessory
- **Language**: TypeScript
- **Polling**: 120-second interval; accessories serve cached values instantly; commands trigger an immediate out-of-cycle refresh
- **Auth**: OAuth 2.0 authorization code + PKCE — OAuth client ID/secret + VCC API Key stored in `config.json`; user completes a one-time browser flow, tokens persist in `<storagePath>/volvo-tokens.json` and auto-refresh
- **Location**: Not exposed (HomeKit has no GPS concept)

---

## Accessories

| Class | HomeKit Service | Reads | Commands |
|---|---|---|---|
| `LockAccessory` | `LockMechanism` | Current lock state (`centralLock` from `/doors`) | Lock, Unlock |
| `BatteryAccessory` | `Battery` | Level %, ChargingState, StatusLowBattery | — |
| `DoorAccessory` | `ContactSensor` | Open/closed per door (FL, FR, RL, RR, Hood, Trunk) | — |
| `WindowAccessory` | `ContactSensor` | Open/closed per window (FL, FR, RL, RR) | — |
| `ClimatizationAccessory` | `Switch` | On/Off state | Start, Stop |
| `LightsAccessory` | `Switch` | Always off (momentary) | Flash |

---

## Project Structure

```
homebridge-volvo-ev/
├── src/
│   ├── index.ts                    # Plugin entry — registers VolvoPlatform with Homebridge
│   ├── platform.ts                 # VolvoPlatform — init, polling loop, accessory lifecycle
│   ├── cache.ts                    # VehicleCache — shared in-memory state, updated by poller
│   ├── api/
│   │   ├── client.ts               # VolvoApiClient — OAuth token management + all API calls
│   │   └── types.ts                # TypeScript interfaces for all API responses
│   └── accessories/
│       ├── lock.ts
│       ├── battery.ts
│       ├── door.ts                 # Parameterised — one class handles all 6 door sensors
│       ├── window.ts               # Parameterised — one class handles all 4 window sensors
│       ├── climatization.ts
│       └── lights.ts
├── config.schema.json              # Homebridge Config UI X schema
├── package.json
└── tsconfig.json
```

---

## API Reference

**Base URL**: `https://api.volvocars.com/connected-vehicle/v2`

**Auth endpoints**: `https://volvoid.eu.volvocars.com/as/authorization.oauth2` (browser), `https://volvoid.eu.volvocars.com/as/token.oauth2` (token)
- Grant types: `authorization_code` (PKCE S256, redirect `http://localhost:8999/callback`), `refresh_token`
- Token endpoint uses HTTP Basic auth with the OAuth client ID/secret
- Required headers on all API calls: `vcc-api-key`, `Authorization: Bearer <token>`

### Endpoints used

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/vehicles/{vin}/doors` | Door open/closed states + `centralLock` |
| `GET` | `/vehicles/{vin}/windows` | Window open/closed states |
| `GET` | `/vehicles/{vin}/engine-status` | Climatization running state |
| `POST` | `/vehicles/{vin}/commands/lock` | Lock doors |
| `POST` | `/vehicles/{vin}/commands/unlock` | Unlock doors |
| `POST` | `/vehicles/{vin}/commands/climatization-start` | Start climatization |
| `POST` | `/vehicles/{vin}/commands/climatization-stop` | Stop climatization |
| `POST` | `/vehicles/{vin}/commands/flash` | Flash exterior lights |

**Energy API v2** (`https://api.volvocars.com/energy/v2`, scope `energy:state:read`):

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/vehicles/{vin}/state` | Battery level, charging status, charger connection. Top-level object (no `data` wrapper); each field is `{status: 'OK'\|'ERROR', value?, unit?, updatedAt?}` |

Connected Vehicle v2 has no `/lock` or `/recharge-state` endpoints (both 404).

---

## Polling Strategy

1. `VolvoPlatform` starts a `setInterval` at `pollInterval` seconds (default 120)
2. Each tick calls `VolvoApiClient.pollAll()` which fires all GET endpoints in parallel (`Promise.allSettled`)
3. Results are written into `VehicleCache` — failed endpoints leave the prior cached value intact and log a warning
4. All accessory `GET` handlers read from `VehicleCache` synchronously — no blocking
5. All accessory `SET` handlers call `platform.runCommand()` and return immediately — never `await` a Volvo command in a HomeKit write handler. Commands take several seconds; HomeKit times out and re-sends the write, issuing duplicate commands (→ car 422s and API 429s)
6. `runCommand` drops duplicates of a command that is in flight or succeeded within 10s, reverts the HomeKit target on failure, and schedules a debounced refresh 15s later (the car needs time to report the new state). Lock applies `COMPLETED` optimistically
7. On HTTP 429 the client backs off for the server-specified time; polls and commands skip the API until it expires

---

## Auth Flow

1. On `didFinishLaunching`, the platform registers accessories and starts polling immediately — it never blocks on auth
2. `VolvoApiClient.ensureAuthenticated()` loads stored tokens (rejected if incomplete or saved for a different client ID); if none, it starts the browser flow in the background: logs the auth URL and listens on `127.0.0.1:8999` for 5 minutes. Only one flow runs at a time; on timeout, the next poll starts a new one
3. On callback, exchange the code for tokens and persist them atomically (mode 0600). `onAuthorised` triggers an immediate poll
4. `expires_at` = now + `expires_in` − 60s. Before each API call, `ensureToken()` refreshes if past `expires_at`. Concurrent callers share one in-flight refresh (refresh tokens may rotate)
5. If a refresh response omits `refresh_token`, keep the previous one
6. If the token endpoint rejects the refresh (400/401), delete stored tokens and restart the browser flow. Network errors keep tokens and retry later
7. A 401 from the API forces one refresh (unless another caller already replaced that token) and retries once
8. All errors leaving the client are rethrown with secrets stripped — never log a raw `AxiosError` (its config contains the bearer token and API key)

---

## Config Shape

```json
{
  "platform": "VolvoEV",
  "name": "Volvo EV",
  "oauthClientId": "your-oauth-client-id",
  "oauthClientSecret": "your-oauth-client-secret",
  "vccApiKey": "your-vcc-api-key",
  "vin": "YV1XXXXXXXXXX",
  "pollInterval": 120
}
```

---

## Implementation Order

1. `package.json` + `tsconfig.json`
2. `src/api/types.ts` — all response interfaces
3. `src/api/client.ts` — OAuth + HTTP calls
4. `src/cache.ts` — VehicleCache class
5. `src/platform.ts` — VolvoPlatform, polling loop, accessory registration
6. `src/index.ts` — plugin entry point
7. Accessories in order: `lock`, `battery`, `door`, `window`, `climatization`, `lights`
8. `config.schema.json`
