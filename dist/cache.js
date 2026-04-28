"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VehicleCache = void 0;
class VehicleCache {
    constructor() {
        this.snapshot = {};
    }
    update(partial) {
        Object.assign(this.snapshot, partial, { lastUpdated: Date.now() });
    }
    get() {
        return this.snapshot;
    }
}
exports.VehicleCache = VehicleCache;
//# sourceMappingURL=cache.js.map