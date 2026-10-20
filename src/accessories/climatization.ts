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

  private setOn(value: CharacteristicValue): void {
    const { Characteristic } = this.platform;
    this.platform.runCommand(
      value ? 'Climatization start' : 'Climatization stop',
      () => (value ? this.platform.api.startClimatization() : this.platform.api.stopClimatization()),
      undefined,
      () => this.service.updateCharacteristic(Characteristic.On, this.getOn()),
    );
  }
}
