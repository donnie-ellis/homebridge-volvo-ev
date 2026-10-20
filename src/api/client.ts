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
const CALLBACK_HOST = '127.0.0.1';
const CALLBACK_PORT = 8999;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;
const AUTH_FLOW_TIMEOUT_MS = 5 * 60 * 1000;
const EXPIRY_MARGIN_S = 60;

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

interface StoredTokens extends TokenSet {
  clientId: string;
}

/** Thrown when no usable tokens exist and the user must complete the browser flow. */
export class AuthRequiredError extends Error {
  constructor() {
    super('Not authorised with Volvo yet — complete the OAuth flow using the URL in the Homebridge log.');
    this.name = 'AuthRequiredError';
  }
}

/**
 * Builds a log-safe message from an error. Never include the AxiosError itself in
 * logs: its config carries the Authorization and vcc-api-key headers.
 */
function sanitiseError(err: unknown): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status ?? err.code ?? 'no-response';
    const body = err.response?.data !== undefined ? ` ${JSON.stringify(err.response.data)}` : '';
    return `HTTP ${status}:${body}`;
  }
  return err instanceof Error ? err.message : String(err);
}

/** True when the token endpoint rejected the grant itself (revoked/expired/unknown refresh token). */
function isGrantRejected(err: unknown): boolean {
  const status = err instanceof AxiosError ? err.response?.status : undefined;
  return status === 400 || status === 401;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
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
  private refreshing: Promise<void> | null = null;
  private authorising: Promise<void> | null = null;

  /** Called after the browser flow completes and tokens are available. */
  public onAuthorised?: () => void;

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

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  /**
   * Loads stored tokens, or starts the browser flow in the background if there are none.
   * Never blocks on user interaction. Returns true if tokens are available now.
   */
  ensureAuthenticated(): boolean {
    if (this.token) {
      return true;
    }
    if (this.loadStoredTokens()) {
      this.log.info('Loaded stored Volvo tokens.');
      return true;
    }
    this.beginAuthorisation();
    return false;
  }

  /** Starts the browser flow unless one is already running. Errors are logged, not thrown. */
  private beginAuthorisation(): void {
    if (this.authorising) {
      return;
    }
    this.log.warn('No valid Volvo tokens — starting OAuth flow.');
    this.authorising = this.runAuthCodeFlow()
      .then(() => this.onAuthorised?.())
      .catch((err) => this.log.error(`Volvo OAuth flow failed: ${sanitiseError(err)} — will retry on next poll.`))
      .finally(() => {
        this.authorising = null;
      });
  }

  private loadStoredTokens(): boolean {
    let stored: Partial<StoredTokens>;
    try {
      stored = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8')) as Partial<StoredTokens>;
    } catch {
      return false;
    }
    if (!stored.refreshToken || !stored.accessToken) {
      this.log.warn('Stored Volvo token file is incomplete; ignoring it.');
      return false;
    }
    if (stored.clientId !== this.oauthClientId) {
      this.log.warn('Stored Volvo tokens belong to a different OAuth client ID; ignoring them.');
      return false;
    }
    this.token = {
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      expiresAt: stored.expiresAt ?? 0,
    };
    return true;
  }

  private saveTokens(tokenSet: TokenSet): void {
    const stored: StoredTokens = { ...tokenSet, clientId: this.oauthClientId };
    const tmp = `${this.tokenFile}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(stored, null, 2), { mode: 0o600 });
      fs.renameSync(tmp, this.tokenFile);
      fs.chmodSync(this.tokenFile, 0o600);
    } catch (err) {
      this.log.error(`Failed to save Volvo tokens to ${this.tokenFile}: ${sanitiseError(err)}`);
      fs.rmSync(tmp, { force: true });
    }
  }

  private clearTokens(): void {
    this.token = null;
    fs.rmSync(this.tokenFile, { force: true });
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

    // Listen before printing the URL so a fast user can't beat the server.
    const code = this.waitForAuthCode(state);

    this.log.warn('=== Volvo OAuth Setup Required ===');
    this.log.warn('Open the following URL in your browser to authorise the plugin:');
    this.log.warn(authUrl);
    this.log.warn(`Waiting up to 5 minutes for the callback on ${REDIRECT_URI} ...`);
    this.log.warn(
      'If Homebridge runs on another machine, first forward the port from the computer with the browser: ' +
      `ssh -L ${CALLBACK_PORT}:localhost:${CALLBACK_PORT} <user>@<homebridge-host>`,
    );

    await this.exchangeCodeForTokens(await code, verifier);
  }

  private waitForAuthCode(expectedState: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (err: Error | null, code?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        server.close();
        if (err) reject(err);
        else resolve(code!);
      };

      const server = http.createServer((req, res) => {
        const url = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`);
        if (url.pathname !== '/callback') {
          res.statusCode = 404;
          res.end();
          return;
        }

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');

        if (state !== expectedState) {
          res.statusCode = 400;
          res.end('<h1>Invalid callback</h1>');
          return;
        }

        if (error) {
          res.end(`<h1>Authorisation failed</h1><p>${escapeHtml(error)}</p>`);
          finish(new Error(`OAuth error: ${error} — ${url.searchParams.get('error_description') ?? ''}`));
          return;
        }

        if (!code) {
          res.statusCode = 400;
          res.end('<h1>Invalid callback</h1>');
          return;
        }

        res.end('<h1>Authorisation successful!</h1><p>You can close this tab and return to Homebridge.</p>');
        finish(null, code);
      });

      const timer = setTimeout(
        () => finish(new Error('OAuth flow timed out after 5 minutes.')),
        AUTH_FLOW_TIMEOUT_MS,
      );

      server.on('error', (err) => finish(err));
      server.listen(CALLBACK_PORT, CALLBACK_HOST, () => {
        this.log.debug(`OAuth callback server listening on ${CALLBACK_HOST}:${CALLBACK_PORT}`);
      });
    });
  }

  private async postToken(params: URLSearchParams): Promise<Record<string, unknown>> {
    const basicAuth = Buffer.from(`${this.oauthClientId}:${this.oauthClientSecret}`).toString('base64');
    const res = await axios.post<Record<string, unknown>>(TOKEN_URL, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
    });
    return res.data;
  }

  private async exchangeCodeForTokens(code: string, verifier: string): Promise<void> {
    let data: Record<string, unknown>;
    try {
      data = await this.postToken(new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }));
    } catch (err) {
      throw new Error(`Token exchange failed: ${sanitiseError(err)}`);
    }
    this.token = this.parseTokenResponse(data, null);
    this.saveTokens(this.token);
    this.log.info('Volvo authorisation complete. Tokens saved.');
  }

  /** Refreshes the access token. Concurrent callers share a single in-flight request. */
  private refreshAccessToken(): Promise<void> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(): Promise<void> {
    if (!this.token) {
      throw new AuthRequiredError();
    }

    let data: Record<string, unknown>;
    try {
      data = await this.postToken(new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.token.refreshToken,
      }));
    } catch (err) {
      if (isGrantRejected(err)) {
        // The refresh token is dead; retrying it will never work. Start over.
        this.log.error(`Volvo refresh token rejected (${sanitiseError(err)}); re-authorisation required.`);
        this.clearTokens();
        this.beginAuthorisation();
        throw new AuthRequiredError();
      }
      // Network/server error — keep tokens and retry on the next call.
      throw new Error(`Token refresh failed: ${sanitiseError(err)}`);
    }

    this.token = this.parseTokenResponse(data, this.token.refreshToken);
    this.saveTokens(this.token);
    this.log.debug('Access token refreshed.');
  }

  private parseTokenResponse(data: Record<string, unknown>, previousRefreshToken: string | null): TokenSet {
    const accessToken = data['access_token'];
    if (typeof accessToken !== 'string' || !accessToken) {
      throw new Error('Token response did not contain an access_token.');
    }
    // Servers may omit refresh_token on refresh, meaning "keep using the old one".
    const refreshToken = typeof data['refresh_token'] === 'string' && data['refresh_token']
      ? data['refresh_token']
      : previousRefreshToken;
    if (!refreshToken) {
      throw new Error('Token response did not contain a refresh_token.');
    }
    const expiresIn = typeof data['expires_in'] === 'number' ? data['expires_in'] : 1800;
    return {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + (expiresIn - EXPIRY_MARGIN_S) * 1000,
    };
  }

  private async ensureToken(): Promise<string> {
    if (!this.ensureAuthenticated()) {
      throw new AuthRequiredError();
    }
    if (Date.now() >= this.token!.expiresAt) {
      await this.refreshAccessToken();
    }
    if (!this.token) {
      throw new AuthRequiredError();
    }
    return this.token.accessToken;
  }

  /**
   * Performs an authenticated API call. On a 401, forces one token refresh and retries.
   * All errors are rethrown with secrets stripped so callers can log them safely.
   */
  private async request<T>(method: 'get' | 'post', urlPath: string): Promise<T> {
    const send = (accessToken: string) => this.http.request<T>({
      method,
      url: urlPath,
      data: method === 'post' ? {} : undefined,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'vcc-api-key': this.vccApiKey,
        'Content-Type': 'application/json',
      },
    });

    try {
      const accessToken = await this.ensureToken();
      try {
        return (await send(accessToken)).data;
      } catch (err) {
        if (!(err instanceof AxiosError) || err.response?.status !== 401) {
          throw err;
        }
        // Only refresh if nobody else already replaced this token.
        if (this.token?.accessToken === accessToken) {
          this.log.debug(`401 from ${urlPath}; forcing token refresh.`);
          await this.refreshAccessToken();
        }
        return (await send(await this.ensureToken())).data;
      }
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        throw err;
      }
      throw new Error(`${method.toUpperCase()} ${urlPath} failed: ${sanitiseError(err)}`);
    }
  }

  // --- GET endpoints ---

  async getDoors(): Promise<DoorState> {
    return (await this.request<VolvoApiResponse<DoorState>>('get', `/vehicles/${this.vin}/doors`)).data;
  }

  async getWindows(): Promise<WindowState> {
    return (await this.request<VolvoApiResponse<WindowState>>('get', `/vehicles/${this.vin}/windows`)).data;
  }

  async getLock(): Promise<LockState> {
    return (await this.request<VolvoApiResponse<LockState>>('get', `/vehicles/${this.vin}/lock`)).data;
  }

  async getRechargeState(): Promise<RechargeState> {
    return (await this.request<VolvoApiResponse<RechargeState>>('get', `/vehicles/${this.vin}/recharge-state`)).data;
  }

  async getEngineStatus(): Promise<EngineState> {
    return (await this.request<VolvoApiResponse<EngineState>>('get', `/vehicles/${this.vin}/engine-status`)).data;
  }

  // --- Commands ---

  async lock(): Promise<void> {
    await this.request('post', `/vehicles/${this.vin}/commands/lock`);
  }

  async unlock(): Promise<void> {
    await this.request('post', `/vehicles/${this.vin}/commands/unlock`);
  }

  async startClimatization(): Promise<void> {
    await this.request('post', `/vehicles/${this.vin}/commands/climatization-start`);
  }

  async stopClimatization(): Promise<void> {
    await this.request('post', `/vehicles/${this.vin}/commands/climatization-stop`);
  }

  async flash(): Promise<void> {
    await this.request('post', `/vehicles/${this.vin}/commands/flash`);
  }
}
