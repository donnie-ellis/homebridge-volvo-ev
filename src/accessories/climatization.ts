import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import type { VolvoPlatform } from '../platform.js';

export class ClimatizationAccessory {
  private readonly service;

  constructor(
    private readonly platform: VolvoPlatform,
    accessory: PlatformAccessory,
  ) {
    const { Service, Characteristic } = platform;

    accessory
      .getService(Service.AccessoryInformation)
      ?.setCharacteristic(Characteristic.Manufacturer, 'Volvo')
      .setCharacteristic(Characteristic.Model, 'Connected Vehicle');

    this.service =
      accessory.getService(Service.Switch) ??
      accessory.addService(Service.Switch);

    this.service
      .getCharacteristic(Characteristic.On)
      .onGet(() => this.getOn())
      .onSet((value) => this.setOn(value));
  }

  private getOn(): CharacteristicValue {
    const status = this.platform.cache.get().engine?.status?.value;
    return status === 'RUNNING';
  }

  private async setOn(value: CharacteristicValue): Promise<void> {
    try {
      if (value) {
        await this.platform.api.startClimatization();
        this.platform.log.info('Climatization started.');
      } else {
        await this.platform.api.stopClimatization();
        this.platform.log.info('Climatization stopped.');
      }
      await this.platform.refreshCache();
    } catch (err) {
      this.platform.log.error('Climatization command failed:', err);
      throw err;
    }
  }
}
