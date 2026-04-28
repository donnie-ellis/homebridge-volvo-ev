import axios, { AxiosInstance, AxiosError } from 'axios';
import * as http from 'http';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Logger } from 'homebridge';
import type {
  DoorState,
  WindowState,
  LockState,
  RechargeState,
  EngineState,
  VolvoApiResponse,
} from './types.js';

const TOKEN_URL = 'https://volvoid.eu.volvocars.com/as/token.oauth2';
const AUTH_URL = 'https://volvoid.eu.volvocars.com/as/authorization.oauth2';
const API_BASE = 'https://api.volvocars.com/connected-vehicle/v2';
const CALLBACK_PORT = 8999;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

const SCOPES = [
  'openid',
  'conve:vehicle_relation',       // basic vehicle access
  'conve:command_accessibility',  // required for any command
  'conve:commands',               // required for any command
  'conve:doors_status',           // read door open/closed
  'conve:windows_status',         // read window open/closed
  'conve:lock_status',            // read lock state
  'conve:lock',                   // lock command
  'conve:unlock',                 // unlock command
  'conve:battery_charge_level',   // read battery level
  'conve:engine_status',          // read climatization running state
  'conve:climatization_start_stop', // start/stop climatization
  'conve:honk_flash',             // flash lights
].join(' ');

interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

function sanitiseAxiosError(err: unknown): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status ?? 'no-response';
    const body = JSON.stringify(err.response?.data ?? {});
    return `HTTP ${status}: ${body}`;
  }
  return String(err);
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export class VolvoApiClient {
  private http: AxiosInstance;
  private token: TokenSet | null = null;
  private readonly tokenFile: string;

  constructor(
    private readonly vccApiKey: string,
    private readonly vin: string,
    private readonly oauthClientId: string,
    private readonly oauthClientSecret: string,
    private readonly storagePath: string,
    private readonly log: Logger,
  ) {
    this.http = axios.create({ baseURL: API_BASE });
    this.tokenFile = path.join(storagePath, 'volvo-tokens.json');
  }

  // --- Auth ---

  async ensureAuthenticated(): Promise<void> {
    if (this.loadStoredTokens()) {
      this.log.info('Loaded stored Volvo tokens.');
      return;
    }
    this.log.warn('No stored tokens found — starting one-time OAuth flow.');
    await this.runAuthCodeFlow();
  }

  private loadStoredTokens(): boolean {
    try {
      const raw = fs.readFileSync(this.tokenFile, 'utf8');
      const stored = JSON.parse(raw) as TokenSet;
      if (!stored.refreshToken) return false;
      this.token = stored;
      return true;
    } catch {
      return false;
    }
  }

  private saveTokens(tokenSet: TokenSet): void {
    fs.writeFileSync(this.tokenFile, JSON.stringify(tokenSet, null, 2), { mode: 0o600 });
  }

  private async runAuthCodeFlow(): Promise<void> {
    const { verifier, challenge } = generatePkce();
    const state = base64url(crypto.randomBytes(16));

    const authUrl =
      `${AUTH_URL}?response_type=code` +
      `&client_id=${encodeURIComponent(this.oauthClientId)}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&state=${state}` +
      `&code_challenge=${challenge}` +
      `&code_challenge_method=S256`;

    this.log.warn('=== Volvo OAuth Setup Required ===');
    this.log.warn('Open the following URL in your browser to authorise the plugin:');
    this.log.warn(authUrl);
    this.log.warn(`Waiting for callback on http://localhost:${CALLBACK_PORT}/callback ...`);

    const code = await this.waitForAuthCode(state);
    await this.exchangeCodeForTokens(code, verifier);
  }

  private waitForAuthCode(expectedState: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          res.end('<h1>Authorisation failed</h1><p>' + error + '</p>');
          server.close();
          reject(new Error(`OAuth error: ${error} — ${url.searchParams.get('error_description')}`));
          return;
        }

        if (!code || state !== expectedState) {
          res.end('<h1>Invalid callback</h1>');
          return;
        }

        res.end('<h1>Authorisation successful!</h1><p>You can close this tab and return to Homebridge.</p>');
        server.close();
        resolve(code);
      });

      server.listen(CALLBACK_PORT, () => {
        this.log.debug(`OAuth callback server listening on port ${CALLBACK_PORT}`);
      });

      server.on('error', reject);

      // Time out after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('OAuth flow timed out after 5 minutes.'));
      }, 5 * 60 * 1000);
    });
  }

  private async exchangeCodeForTokens(code: string, verifier: string): Promise<void> {
    const basicAuth = Buffer.from(`${this.oauthClientId}:${this.oauthClientSecret}`).toString('base64');
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    });

    try {
      const res = await axios.post(TOKEN_URL, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
      });
      this.token = this.parseTokenResponse(res.data);
      this.saveTokens(this.token);
      this.log.info('Volvo authorisation complete. Tokens saved.');
    } catch (err) {
      throw new Error(`Token exchange failed: ${sanitiseAxiosError(err)}`);
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.token?.refreshToken) {
      throw new Error('No refresh token available. Delete the token file and restart Homebridge to re-authenticate.');
    }

    const basicAuth = Buffer.from(`${this.oauthClientId}:${this.oauthClientSecret}`).toString('base64');
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.token.refreshToken,
    });

    try {
      const res = await axios.post(TOKEN_URL, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
      });
      this.token = this.parseTokenResponse(res.data);
      this.saveTokens(this.token);
      this.log.debug('Access token refreshed.');
    } catch (err) {
      throw new Error(`Token refresh failed: ${sanitiseAxiosError(err)}`);
    }
  }

  private parseTokenResponse(data: Record<string, unknown>): TokenSet {
    const expiresIn = typeof data['expires_in'] === 'number' ? data['expires_in'] : 1800;
    return {
      accessToken: data['access_token'] as string,
      refreshToken: data['refresh_token'] as string,
      expiresAt: Date.now() + (expiresIn - 60) * 1000,
    };
  }

  private async ensureToken(): Promise<string> {
    if (!this.token) {
      await this.ensureAuthenticated();
    } else if (Date.now() >= this.token.expiresAt) {
      await this.refreshAccessToken();
    }
    return this.token!.accessToken;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.ensureToken();
    return {
      Authorization: `Bearer ${token}`,
      'vcc-api-key': this.vccApiKey,
      'Content-Type': 'application/json',
    };
  }

  // --- GET endpoints ---

  async getDoors(): Promise<DoorState> {
    const headers = await this.authHeaders();
    const res = await this.http.get<VolvoApiResponse<DoorState>>(
      `/vehicles/${this.vin}/doors`,
      { headers },
    );
    return res.data.data;
  }

  async getWindows(): Promise<WindowState> {
    const headers = await this.authHeaders();
    const res = await this.http.get<VolvoApiResponse<WindowState>>(
      `/vehicles/${this.vin}/windows`,
      { headers },
    );
    return res.data.data;
  }

  async getLock(): Promise<LockState> {
    const headers = await this.authHeaders();
    const res = await this.http.get<VolvoApiResponse<LockState>>(
      `/vehicles/${this.vin}/lock`,
      { headers },
    );
    return res.data.data;
  }

  async getRechargeState(): Promise<RechargeState> {
    const headers = await this.authHeaders();
    const res = await this.http.get<VolvoApiResponse<RechargeState>>(
      `/vehicles/${this.vin}/recharge-state`,
      { headers },
    );
    return res.data.data;
  }

  async getEngineStatus(): Promise<EngineState> {
    const headers = await this.authHeaders();
    const res = await this.http.get<VolvoApiResponse<EngineState>>(
      `/vehicles/${this.vin}/engine-status`,
      { headers },
    );
    return res.data.data;
  }

  // --- Commands ---

  async lock(): Promise<void> {
    const headers = await this.authHeaders();
    await this.http.post(`/vehicles/${this.vin}/commands/lock`, {}, { headers });
  }

  async unlock(): Promise<void> {
    const headers = await this.authHeaders();
    await this.http.post(`/vehicles/${this.vin}/commands/unlock`, {}, { headers });
  }

  async startClimatization(): Promise<void> {
    const headers = await this.authHeaders();
    await this.http.post(`/vehicles/${this.vin}/commands/climatization-start`, {}, { headers });
  }

  async stopClimatization(): Promise<void> {
    const headers = await this.authHeaders();
    await this.http.post(`/vehicles/${this.vin}/commands/climatization-stop`, {}, { headers });
  }

  async flash(): Promise<void> {
    const headers = await this.authHeaders();
    await this.http.post(`/vehicles/${this.vin}/commands/flash`, {}, { headers });
  }
}
