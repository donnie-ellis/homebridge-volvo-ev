# homebridge-volvo-ev

A [Homebridge](https://homebridge.io) platform plugin that exposes your Volvo EV to Apple HomeKit using the [Volvo Connected Vehicle API v2](https://developer.volvocars.com/apis/connected-vehicle/v2/overview/).

## Accessories

Each capability is exposed as an independent HomeKit accessory:

| Accessory | HomeKit Type | Capabilities |
|---|---|---|
| Door Lock | Lock Mechanism | Read lock state, lock, unlock |
| Battery | Battery | Charge level, charging state, low battery alert |
| Front Left Door | Contact Sensor | Open / closed |
| Front Right Door | Contact Sensor | Open / closed |
| Rear Left Door | Contact Sensor | Open / closed |
| Rear Right Door | Contact Sensor | Open / closed |
| Hood | Contact Sensor | Open / closed |
| Tailgate | Contact Sensor | Open / closed |
| Front Left Window | Contact Sensor | Open / closed |
| Front Right Window | Contact Sensor | Open / closed |
| Rear Left Window | Contact Sensor | Open / closed |
| Rear Right Window | Contact Sensor | Open / closed |
| Climatization | Switch | Start / stop remote climate |
| Flash Lights | Switch | Flash exterior lights (momentary) |

## Requirements

- [Homebridge](https://homebridge.io) v1.8.0 or later
- Node.js v18 or later
- A Volvo ID account
- A published application on [developer.volvocars.com](https://developer.volvocars.com) with:
  - A **VCC API Key**
  - OAuth **client_id** and **client_secret** (emailed to you after publishing)
  - `http://localhost:8999/callback` registered as a redirect URI

## Installation

```bash
npm install -g homebridge-volvo-ev
```

Or install via the Homebridge UI plugin search.

## Configuration

Add the following to the `platforms` array in your Homebridge `config.json`:

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

| Field | Required | Description |
|---|---|---|
| `oauthClientId` | Yes | OAuth client ID from Volvo developer portal |
| `oauthClientSecret` | Yes | OAuth client secret from Volvo developer portal |
| `vccApiKey` | Yes | VCC API Key from your app on developer.volvocars.com |
| `vin` | Yes | Your vehicle's 17-character VIN |
| `pollInterval` | No | Seconds between data refreshes (default: 120, minimum: 60) |

## First-time setup

On first launch, the plugin cannot authenticate automatically — it needs you to complete a one-time browser-based OAuth flow:

1. Start (or restart) Homebridge
2. Watch the Homebridge log for a message from `[Volvo EV]` containing an authorization URL
3. Open that URL in any browser and sign in with your Volvo ID
4. After authorising, your browser will show a success message
5. The plugin saves your tokens to `~/.homebridge/volvo-tokens.json` and continues normally

From that point on, the plugin handles token refresh silently. You will not need to repeat this unless you revoke access or delete the token file.

## Data refresh

Vehicle state is fetched every `pollInterval` seconds (default 120). HomeKit requests are served from the local cache instantly. When you send a command (lock, unlock, etc.), the plugin executes it immediately and triggers an out-of-cycle refresh to update the cache.

## Troubleshooting

**Plugin logs an auth URL on every restart**
The token file is missing or corrupt. Delete `~/.homebridge/volvo-tokens.json` and complete the browser flow again.

**Poll failures in the log**
Usually means the car is out of mobile network range (e.g. in a garage with no signal). The plugin will retry on the next interval; stale values are served in the meantime.

**Commands fail but polling works**
Some commands require the car to be in network range and may not be available in all markets. Check that the required scopes are approved for your application on the developer portal.

## License

MIT — see [LICENSE](LICENSE).  
Not affiliated with or endorsed by Volvo Cars Group.  
Use of this plugin is subject to the [End User License Agreement](EULA.md).
