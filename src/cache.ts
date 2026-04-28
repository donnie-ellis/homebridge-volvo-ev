import type { DoorState, WindowState, LockState, RechargeState, EngineState } from './api/types.js';

export interface VehicleSnapshot {
  doors?: DoorState;
  windows?: WindowState;
  lock?: LockState;
  recharge?: RechargeState;
  engine?: EngineState;
  lastUpdated?: number; // unix ms
}

export class VehicleCache {
  private snapshot: VehicleSnapshot = {};

  update(partial: Partial<VehicleSnapshot>): void {
    Object.assign(this.snapshot, partial, { lastUpdated: Date.now() });
  }

  get(): Readonly<VehicleSnapshot> {
    return this.snapshot;
  }
}
