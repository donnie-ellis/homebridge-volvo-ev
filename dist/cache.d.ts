import type { DoorState, WindowState, LockState, RechargeState, EngineState } from './api/types.js';
export interface VehicleSnapshot {
    doors?: DoorState;
    windows?: WindowState;
    lock?: LockState;
    recharge?: RechargeState;
    engine?: EngineState;
    lastUpdated?: number;
}
export declare class VehicleCache {
    private snapshot;
    update(partial: Partial<VehicleSnapshot>): void;
    get(): Readonly<VehicleSnapshot>;
}
//# sourceMappingURL=cache.d.ts.map