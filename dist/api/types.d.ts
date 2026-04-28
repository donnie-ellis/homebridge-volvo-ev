export interface VolvoApiResponse<T> {
    data: T;
}
export type DoorStatus = 'OPEN' | 'CLOSED' | 'AJAR';
export interface DoorState {
    frontLeft: {
        value: DoorStatus;
    };
    frontRight: {
        value: DoorStatus;
    };
    rearLeft: {
        value: DoorStatus;
    };
    rearRight: {
        value: DoorStatus;
    };
    hood: {
        value: DoorStatus;
    };
    tailgate: {
        value: DoorStatus;
    };
}
export type WindowStatus = 'OPEN' | 'CLOSED' | 'AJAR';
export interface WindowState {
    frontLeft: {
        value: WindowStatus;
    };
    frontRight: {
        value: WindowStatus;
    };
    rearLeft: {
        value: WindowStatus;
    };
    rearRight: {
        value: WindowStatus;
    };
}
export type LockStatus = 'LOCKED' | 'UNLOCKED' | 'UNKNOWN';
export interface LockState {
    carLocked: {
        value: LockStatus;
    };
}
export type ChargingSystemStatus = 'CHARGING_SYSTEM_CHARGING' | 'CHARGING_SYSTEM_IDLE' | 'CHARGING_SYSTEM_FAULT' | 'CHARGING_SYSTEM_UNSPECIFIED';
export interface RechargeState {
    batteryChargeLevel: {
        value: number;
    };
    chargingSystemStatus: {
        value: ChargingSystemStatus;
    };
    electricRange: {
        value: number;
    };
    estimatedChargingTime: {
        value: number;
    };
}
export type EngineStatus = 'RUNNING' | 'STOPPED';
export interface EngineState {
    status: {
        value: EngineStatus;
    };
}
export interface CommandResponse {
    invokeStatus: 'COMPLETED' | 'FAILED' | 'UNKNOWN';
}
//# sourceMappingURL=types.d.ts.map