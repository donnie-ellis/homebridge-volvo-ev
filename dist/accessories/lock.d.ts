import { PlatformAccessory } from 'homebridge';
import type { VolvoPlatform } from '../platform.js';
export declare class LockAccessory {
    private readonly platform;
    private readonly service;
    constructor(platform: VolvoPlatform, accessory: PlatformAccessory);
    private getCurrentState;
    private getTargetState;
    private setTargetState;
}
//# sourceMappingURL=lock.d.ts.map