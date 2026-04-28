import type { Logger } from 'homebridge';
import type { DoorState, WindowState, LockState, RechargeState, EngineState } from './types.js';
export declare class VolvoApiClient {
    private readonly vccApiKey;
    private readonly vin;
    private readonly oauthClientId;
    private readonly oauthClientSecret;
    private readonly storagePath;
    private readonly log;
    private http;
    private token;
    private readonly tokenFile;
    constructor(vccApiKey: string, vin: string, oauthClientId: string, oauthClientSecret: string, storagePath: string, log: Logger);
    ensureAuthenticated(): Promise<void>;
    private loadStoredTokens;
    private saveTokens;
    private runAuthCodeFlow;
    private waitForAuthCode;
    private exchangeCodeForTokens;
    private refreshAccessToken;
    private parseTokenResponse;
    private ensureToken;
    private authHeaders;
    getDoors(): Promise<DoorState>;
    getWindows(): Promise<WindowState>;
    getLock(): Promise<LockState>;
    getRechargeState(): Promise<RechargeState>;
    getEngineStatus(): Promise<EngineState>;
    lock(): Promise<void>;
    unlock(): Promise<void>;
    startClimatization(): Promise<void>;
    stopClimatization(): Promise<void>;
    flash(): Promise<void>;
}
//# sourceMappingURL=client.d.ts.map