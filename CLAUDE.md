# homebridge-volvo-ev

A Homebridge platform plugin that exposes a Volvo EV's connected vehicle data to Apple HomeKit using the Volvo Connected Vehicle API v2.

---

## Design Decisions

- **Vehicle type**: EV (no fuel/ICE endpoints)
- **Architecture**: Option B — multiple independent accessories (one per capability), not one monolithic accessory
- **Language**: TypeScript
- **Polling**: 120-second interval; accessories serve cached values instantly; commands trigger an immediate out-of-cycle refresh
- **Auth**: OAuth 2.0 password grant — Volvo ID credentials + VCC API Key stored in `config.json`; plugin handles token acquisition and auto-refresh
- **Location**: Not exposed (HomeKit has no GPS concept)

---

## Accessories

| Class | HomeKit Service | Reads | Commands |
|---|---|---|---|
| `LockAccessory` | `LockMechanism` | Current lock state | Lock, Unlock |
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

**Auth endpoint**: `https://volvoid.eu.volvocars.com/as/token.oauth2`
- Grant type: `password`
- Required headers on all API calls: `vcc-api-key`, `Authorization: Bearer <token>`

### Endpoints used

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/vehicles/{vin}/doors` | Door open/closed states |
| `GET` | `/vehicles/{vin}/windows` | Window open/closed states |
| `GET` | `/vehicles/{vin}/lock` | Lock status |
| `GET` | `/vehicles/{vin}/recharge-state` | Battery level + charging state |
| `GET` | `/vehicles/{vin}/engine-status` | Climatization running state |
| `POST` | `/vehicles/{vin}/commands/lock` | Lock doors |
| `POST` | `/vehicles/{vin}/commands/unlock` | Unlock doors |
| `POST` | `/vehicles/{vin}/commands/climatization-start` | Start climatization |
| `POST` | `/vehicles/{vin}/commands/climatization-stop` | Stop climatization |
| `POST` | `/vehicles/{vin}/commands/flash` | Flash exterior lights |

---

## Polling Strategy

1. `VolvoPlatform` starts a `setInterval` at `pollInterval` seconds (default 120)
2. Each tick calls `VolvoApiClient.pollAll()` which fires all GET endpoints in parallel (`Promise.allSettled`)
3. Results are written into `VehicleCache` — failed endpoints leave the prior cached value intact and log a warning
4. All accessory `GET` handlers read from `VehicleCache` synchronously — no blocking
5. All accessory `SET` handlers call the API directly, `await` the result, then call `platform.refreshCache()` for an immediate re-poll

---

## Auth Flow

1. On platform `init`, call `VolvoApiClient.authenticate()` — POST to token endpoint with username/password + client credentials
2. Store `access_token`, `refresh_token`, `expires_at` (now + `expires_in` seconds) in memory
3. Before every API call, `VolvoApiClient.ensureToken()` checks `expires_at`; if within 60s of expiry, refresh using the refresh token
4. If refresh fails (e.g. session revoked), log an error and re-authenticate from credentials

---

## Config Shape

```json
{
  "platform": "VolvoEV",
  "name": "Volvo EV",
  "username": "you@example.com",
  "password": "yourpassword",
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
