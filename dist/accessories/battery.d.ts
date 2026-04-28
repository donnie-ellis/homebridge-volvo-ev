import { PlatformAccessory } from 'homebridge';
import type { VolvoPlatform } from '../platform.js';
export declare class BatteryAccessory {
    private readonly platform;
    private readonly service;
    constructor(platform: VolvoPlatform, accessory: PlatformAccessory);
    private getBatteryLevel;
    private getChargingState;
    private getLowBatteryStatus;
}
//# sourceMappingURL=battery.d.ts.map