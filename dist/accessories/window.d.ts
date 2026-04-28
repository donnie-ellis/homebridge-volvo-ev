import { PlatformAccessory } from 'homebridge';
import type { VolvoPlatform } from '../platform.js';
import type { WindowState } from '../api/types.js';
export type WindowKey = keyof WindowState;
export declare class WindowAccessory {
    private readonly platform;
    private readonly windowKey;
    private readonly service;
    constructor(platform: VolvoPlatform, accessory: PlatformAccessory, windowKey: WindowKey);
    private getContactState;
}
//# sourceMappingURL=window.d.ts.map