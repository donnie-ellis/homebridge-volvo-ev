"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolvoPlatform = void 0;
const index_js_1 = require("./index.js");
const client_js_1 = require("./api/client.js");
const cache_js_1 = require("./cache.js");
const lock_js_1 = require("./accessories/lock.js");
const battery_js_1 = require("./accessories/battery.js");
const door_js_1 = require("./accessories/door.js");
const window_js_1 = require("./accessories/window.js");
const climatization_js_1 = require("./accessories/climatization.js");
const lights_js_1 = require("./accessories/lights.js");
const DOOR_KEYS = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight', 'hood', 'tailgate'];
const DOOR_NAMES = {
    frontLeft: 'Front Left Door',
    frontRight: 'Front Right Door',
    rearLeft: 'Rear Left Door',
    rearRight: 'Rear Right Door',
    hood: 'Hood',
    tailgate: 'Tailgate',
};
const WINDOW_KEYS = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'];
const WINDOW_NAMES = {
    frontLeft: 'Front Left Window',
    frontRight: 'Front Right Window',
    rearLeft: 'Rear Left Window',
    rearRight: 'Rear Right Window',
};
class VolvoPlatform {
    constructor(log, config, hbApi) {
        this.log = log;
        this.config = config;
        this.hbApi = hbApi;
        this.accessories = [];
        this.Service = hbApi.hap.Service;
        this.Characteristic = hbApi.hap.Characteristic;
        this.cache = new cache_js_1.VehicleCache();
        this.pollInterval = (config.pollInterval ?? 120) * 1000;
        this.api = new client_js_1.VolvoApiClient(config.vccApiKey, config.vin, config.oauthClientId, config.oauthClientSecret, hbApi.user.storagePath(), log);
        hbApi.on('didFinishLaunching', () => {
            this.init().catch((err) => log.error('Failed to initialise Volvo platform:', err));
        });
    }
    configureAccessory(accessory) {
        this.accessories.push(accessory);
    }
    async init() {
        await this.api.ensureAuthenticated();
        await this.refreshCache();
        this.registerAccessories();
        this.pollTimer = setInterval(() => {
            this.refreshCache().catch((err) => this.log.warn('Poll failed:', err));
        }, this.pollInterval);
    }
    async refreshCache() {
        const results = await Promise.allSettled([
            this.api.getDoors(),
            this.api.getWindows(),
            this.api.getLock(),
            this.api.getRechargeState(),
            this.api.getEngineStatus(),
        ]);
        const [doors, windows, lock, recharge, engine] = results;
        if (doors.status === 'fulfilled')
            this.cache.update({ doors: doors.value });
        else
            this.log.warn('Failed to fetch doors:', doors.reason);
        if (windows.status === 'fulfilled')
            this.cache.update({ windows: windows.value });
        else
            this.log.warn('Failed to fetch windows:', windows.reason);
        if (lock.status === 'fulfilled')
            this.cache.update({ lock: lock.value });
        else
            this.log.warn('Failed to fetch lock:', lock.reason);
        if (recharge.status === 'fulfilled')
            this.cache.update({ recharge: recharge.value });
        else
            this.log.warn('Failed to fetch recharge state:', recharge.reason);
        if (engine.status === 'fulfilled')
            this.cache.update({ engine: engine.value });
        else
            this.log.warn('Failed to fetch engine status:', engine.reason);
    }
    registerAccessories() {
        this.addAccessory('volvo-lock', 'Door Lock', (acc) => new lock_js_1.LockAccessory(this, acc));
        this.addAccessory('volvo-battery', 'Battery', (acc) => new battery_js_1.BatteryAccessory(this, acc));
        for (const key of DOOR_KEYS) {
            this.addAccessory(`volvo-door-${key}`, DOOR_NAMES[key], (acc) => new door_js_1.DoorAccessory(this, acc, key));
        }
        for (const key of WINDOW_KEYS) {
            this.addAccessory(`volvo-window-${key}`, WINDOW_NAMES[key], (acc) => new window_js_1.WindowAccessory(this, acc, key));
        }
        this.addAccessory('volvo-climatization', 'Climatization', (acc) => new climatization_js_1.ClimatizationAccessory(this, acc));
        this.addAccessory('volvo-lights', 'Flash Lights', (acc) => new lights_js_1.LightsAccessory(this, acc));
    }
    addAccessory(id, name, factory) {
        const uuid = this.hbApi.hap.uuid.generate(`${this.config.vin}-${id}`);
        const existing = this.accessories.find((a) => a.UUID === uuid);
        if (existing) {
            this.log.debug(`Restoring cached accessory: ${name}`);
            factory(existing);
        }
        else {
            this.log.debug(`Registering new accessory: ${name}`);
            const accessory = new this.hbApi.platformAccessory(name, uuid);
            factory(accessory);
            this.hbApi.registerPlatformAccessories(index_js_1.PLUGIN_NAME, index_js_1.PLATFORM_NAME, [accessory]);
        }
    }
}
exports.VolvoPlatform = VolvoPlatform;
//# sourceMappingURL=platform.js.map