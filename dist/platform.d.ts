import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { VolvoApiClient } from './api/client.js';
import { VehicleCache } from './cache.js';
export interface VolvoConfig extends PlatformConfig {
    vccApiKey: string;
    oauthClientId: string;
    oauthClientSecret: string;
    vin: string;
    pollInterval?: number;
}
export declare class VolvoPlatform implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly config: VolvoConfig;
    readonly hbApi: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly accessories: PlatformAccessory[];
    readonly cache: VehicleCache;
    readonly api: VolvoApiClient;
    private readonly pollInterval;
    private pollTimer?;
    constructor(log: Logger, config: VolvoConfig, hbApi: API);
    configureAccessory(accessory: PlatformAccessory): void;
    private init;
    refreshCache(): Promise<void>;
    private registerAccessories;
    private addAccessory;
}
//# sourceMappingURL=platform.d.ts.map