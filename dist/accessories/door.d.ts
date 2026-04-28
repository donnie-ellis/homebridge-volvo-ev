import { PlatformAccessory } from 'homebridge';
import type { VolvoPlatform } from '../platform.js';
import type { DoorState } from '../api/types.js';
export type DoorKey = keyof DoorState;
export declare class DoorAccessory {
    private readonly platform;
    private readonly doorKey;
    private readonly service;
    constructor(platform: VolvoPlatform, accessory: PlatformAccessory, doorKey: DoorKey);
    private getContactState;
}
//# sourceMappingURL=door.d.ts.map