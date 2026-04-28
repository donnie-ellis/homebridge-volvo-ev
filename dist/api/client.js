"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolvoApiClient = void 0;
const axios_1 = __importStar(require("axios"));
const http = __importStar(require("http"));
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const TOKEN_URL = 'https://volvoid.eu.volvocars.com/as/token.oauth2';
const AUTH_URL = 'https://volvoid.eu.volvocars.com/as/authorization.oauth2';
const API_BASE = 'https://api.volvocars.com/connected-vehicle/v2';
const CALLBACK_PORT = 8999;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;
const SCOPES = [
    'openid',
    'connected-vehicle:vehicle_relation:read',
    'connected-vehicle:doors:read',
    'connected-vehicle:windows:read',
    'connected-vehicle:lock:read',
    'connected-vehicle:lock:execute',
    'connected-vehicle:recharge:read',
    'connected-vehicle:engine:read',
    'connected-vehicle:climatization:execute',
    'connected-vehicle:horn-lights:execute',
].join(' ');
function sanitiseAxiosError(err) {
    if (err instanceof axios_1.AxiosError) {
        const status = err.response?.status ?? 'no-response';
        const body = JSON.stringify(err.response?.data ?? {});
        return `HTTP ${status}: ${body}`;
    }
    return String(err);
}
function base64url(buf) {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function generatePkce() {
    const verifier = base64url(crypto.randomBytes(32));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
    return { verifier, challenge };
}
class VolvoApiClient {
    constructor(vccApiKey, vin, oauthClientId, oauthClientSecret, storagePath, log) {
        this.vccApiKey = vccApiKey;
        this.vin = vin;
        this.oauthClientId = oauthClientId;
        this.oauthClientSecret = oauthClientSecret;
        this.storagePath = storagePath;
        this.log = log;
        this.token = null;
        this.http = axios_1.default.create({ baseURL: API_BASE });
        this.tokenFile = path.join(storagePath, 'volvo-tokens.json');
    }
    // --- Auth ---
    async ensureAuthenticated() {
        if (this.loadStoredTokens()) {
            this.log.info('Loaded stored Volvo tokens.');
            return;
        }
        this.log.warn('No stored tokens found — starting one-time OAuth flow.');
        await this.runAuthCodeFlow();
    }
    loadStoredTokens() {
        try {
            const raw = fs.readFileSync(this.tokenFile, 'utf8');
            const stored = JSON.parse(raw);
            if (!stored.refreshToken)
                return false;
            this.token = stored;
            return true;
        }
        catch {
            return false;
        }
    }
    saveTokens(tokenSet) {
        fs.writeFileSync(this.tokenFile, JSON.stringify(tokenSet, null, 2), { mode: 0o600 });
    }
    async runAuthCodeFlow() {
        const { verifier, challenge } = generatePkce();
        const state = base64url(crypto.randomBytes(16));
        const authUrl = `${AUTH_URL}?response_type=code` +
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
    waitForAuthCode(expectedState) {
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
    async exchangeCodeForTokens(code, verifier) {
        const basicAuth = Buffer.from(`${this.oauthClientId}:${this.oauthClientSecret}`).toString('base64');
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier,
        });
        try {
            const res = await axios_1.default.post(TOKEN_URL, params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${basicAuth}`,
                },
            });
            this.token = this.parseTokenResponse(res.data);
            this.saveTokens(this.token);
            this.log.info('Volvo authorisation complete. Tokens saved.');
        }
        catch (err) {
            throw new Error(`Token exchange failed: ${sanitiseAxiosError(err)}`);
        }
    }
    async refreshAccessToken() {
        if (!this.token?.refreshToken) {
            throw new Error('No refresh token available. Delete the token file and restart Homebridge to re-authenticate.');
        }
        const basicAuth = Buffer.from(`${this.oauthClientId}:${this.oauthClientSecret}`).toString('base64');
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: this.token.refreshToken,
        });
        try {
            const res = await axios_1.default.post(TOKEN_URL, params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${basicAuth}`,
                },
            });
            this.token = this.parseTokenResponse(res.data);
            this.saveTokens(this.token);
            this.log.debug('Access token refreshed.');
        }
        catch (err) {
            throw new Error(`Token refresh failed: ${sanitiseAxiosError(err)}`);
        }
    }
    parseTokenResponse(data) {
        const expiresIn = typeof data['expires_in'] === 'number' ? data['expires_in'] : 1800;
        return {
            accessToken: data['access_token'],
            refreshToken: data['refresh_token'],
            expiresAt: Date.now() + (expiresIn - 60) * 1000,
        };
    }
    async ensureToken() {
        if (!this.token) {
            await this.ensureAuthenticated();
        }
        else if (Date.now() >= this.token.expiresAt) {
            await this.refreshAccessToken();
        }
        return this.token.accessToken;
    }
    async authHeaders() {
        const token = await this.ensureToken();
        return {
            Authorization: `Bearer ${token}`,
            'vcc-api-key': this.vccApiKey,
            'Content-Type': 'application/json',
        };
    }
    // --- GET endpoints ---
    async getDoors() {
        const headers = await this.authHeaders();
        const res = await this.http.get(`/vehicles/${this.vin}/doors`, { headers });
        return res.data.data;
    }
    async getWindows() {
        const headers = await this.authHeaders();
        const res = await this.http.get(`/vehicles/${this.vin}/windows`, { headers });
        return res.data.data;
    }
    async getLock() {
        const headers = await this.authHeaders();
        const res = await this.http.get(`/vehicles/${this.vin}/lock`, { headers });
        return res.data.data;
    }
    async getRechargeState() {
        const headers = await this.authHeaders();
        const res = await this.http.get(`/vehicles/${this.vin}/recharge-state`, { headers });
        return res.data.data;
    }
    async getEngineStatus() {
        const headers = await this.authHeaders();
        const res = await this.http.get(`/vehicles/${this.vin}/engine-status`, { headers });
        return res.data.data;
    }
    // --- Commands ---
    async lock() {
        const headers = await this.authHeaders();
        await this.http.post(`/vehicles/${this.vin}/commands/lock`, {}, { headers });
    }
    async unlock() {
        const headers = await this.authHeaders();
        await this.http.post(`/vehicles/${this.vin}/commands/unlock`, {}, { headers });
    }
    async startClimatization() {
        const headers = await this.authHeaders();
        await this.http.post(`/vehicles/${this.vin}/commands/climatization-start`, {}, { headers });
    }
    async stopClimatization() {
        const headers = await this.authHeaders();
        await this.http.post(`/vehicles/${this.vin}/commands/climatization-stop`, {}, { headers });
    }
    async flash() {
        const headers = await this.authHeaders();
        await this.http.post(`/vehicles/${this.vin}/commands/flash`, {}, { headers });
    }
}
exports.VolvoApiClient = VolvoApiClient;
//# sourceMappingURL=client.js.map