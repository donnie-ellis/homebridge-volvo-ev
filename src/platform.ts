import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './index.js';
import { VolvoApiClient } from './api/client.js';
import { VehicleCache } from './cache.js';
import { LockAccessory } from './accessories/lock.js';
import { BatteryAccessory } from './accessories/battery.js';
import { DoorAccessory, DoorKey } from './accessories/door.js';
import { WindowAccessory, WindowKey } from './accessories/window.js';
import { ClimatizationAccessory } from './accessories/climatization.js';
import { LightsAccessory } from './accessories/lights.js';

export interface VolvoConfig extends PlatformConfig {
  vccApiKey: string;
  oauthClientId: string;
  oauthClientSecret: string;
  vin: string;
  pollInterval?: number;
}

const DOOR_KEYS: DoorKey[] = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight', 'hood', 'tailgate'];
const DOOR_NAMES: Record<DoorKey, string> = {
  frontLeft: 'Front Left Door',
  frontRight: 'Front Right Door',
  rearLeft: 'Rear Left Door',
  rearRight: 'Rear Right Door',
  hood: 'Hood',
  tailgate: 'Tailgate',
};

const WINDOW_KEYS: WindowKey[] = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'];
const WINDOW_NAMES: Record<WindowKey, string> = {
  frontLeft: 'Front Left Window',
  frontRight: 'Front Right Window',
  rearLeft: 'Rear Left Window',
  rearRight: 'Rear Right Window',
};

export class VolvoPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  public readonly accessories: PlatformAccessory[] = [];
  public readonly cache: VehicleCache;
  public readonly api: VolvoApiClient;

  private readonly pollInterval: number;
  private pollTimer?: ReturnType<typeof setInterval>;

  constructor(
    public readonly log: Logger,
    public readonly config: VolvoConfig,
    public readonly hbApi: API,
  ) {
    this.Service = hbApi.hap.Service;
    this.Characteristic = hbApi.hap.Characteristic;

    this.cache = new VehicleCache();
    this.pollInterval = (config.pollInterval ?? 120) * 1000;

    this.api = new VolvoApiClient(
      config.vccApiKey,
      config.vin,
      config.oauthClientId,
      config.oauthClientSecret,
      hbApi.user.storagePath(),
      log,
    );

    hbApi.on('didFinishLaunching', () => {
      this.init().catch((err) => log.error('Failed to initialise Volvo platform:', err));
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.accessories.push(accessory);
  }

  private async init(): Promise<void> {
    await this.api.ensureAuthenticated();
    await this.refreshCache();
    this.registerAccessories();
    this.pollTimer = setInterval(() => {
      this.refreshCache().catch((err) => this.log.warn('Poll failed:', err));
    }, this.pollInterval);
  }

  public async refreshCache(): Promise<void> {
    const results = await Promise.allSettled([
      this.api.getDoors(),
      this.api.getWindows(),
      this.api.getLock(),
      this.api.getRechargeState(),
      this.api.getEngineStatus(),
    ]);

    const [doors, windows, lock, recharge, engine] = results;

    if (doors.status === 'fulfilled') this.cache.update({ doors: doors.value });
    else this.log.warn('Failed to fetch doors:', doors.reason);

    if (windows.status === 'fulfilled') this.cache.update({ windows: windows.value });
    else this.log.warn('Failed to fetch windows:', windows.reason);

    if (lock.status === 'fulfilled') this.cache.update({ lock: lock.value });
    else this.log.warn('Failed to fetch lock:', lock.reason);

    if (recharge.status === 'fulfilled') this.cache.update({ recharge: recharge.value });
    else this.log.warn('Failed to fetch recharge state:', recharge.reason);

    if (engine.status === 'fulfilled') this.cache.update({ engine: engine.value });
    else this.log.warn('Failed to fetch engine status:', engine.reason);
  }

  private registerAccessories(): void {
    this.addAccessory('volvo-lock', 'Door Lock', (acc) => new LockAccessory(this, acc));

    this.addAccessory('volvo-battery', 'Battery', (acc) => new BatteryAccessory(this, acc));

    for (const key of DOOR_KEYS) {
      this.addAccessory(`volvo-door-${key}`, DOOR_NAMES[key], (acc) =>
        new DoorAccessory(this, acc, key),
      );
    }

    for (const key of WINDOW_KEYS) {
      this.addAccessory(`volvo-window-${key}`, WINDOW_NAMES[key], (acc) =>
        new WindowAccessory(this, acc, key),
      );
    }

    this.addAccessory('volvo-climatization', 'Climatization', (acc) =>
      new ClimatizationAccessory(this, acc),
    );

    this.addAccessory('volvo-lights', 'Flash Lights', (acc) => new LightsAccessory(this, acc));
  }

  private addAccessory(
    id: string,
    name: string,
    factory: (acc: PlatformAccessory) => void,
  ): void {
    const uuid = this.hbApi.hap.uuid.generate(`${this.config.vin}-${id}`);
    const existing = this.accessories.find((a) => a.UUID === uuid);

    if (existing) {
      this.log.debug(`Restoring cached accessory: ${name}`);
      factory(existing);
    } else {
      this.log.debug(`Registering new accessory: ${name}`);
      const accessory = new this.hbApi.platformAccessory(name, uuid);
      factory(accessory);
      this.hbApi.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }
}
