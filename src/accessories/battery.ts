import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import type { VolvoPlatform } from '../platform.js';

const LOW_BATTERY_THRESHOLD = 20;

export class BatteryAccessory {
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
      accessory.getService(Service.Battery) ??
      accessory.addService(Service.Battery);

    this.service
      .getCharacteristic(Characteristic.BatteryLevel)
      .onGet(() => this.getBatteryLevel());

    this.service
      .getCharacteristic(Characteristic.ChargingState)
      .onGet(() => this.getChargingState());

    this.service
      .getCharacteristic(Characteristic.StatusLowBattery)
      .onGet(() => this.getLowBatteryStatus());
  }

  private getBatteryLevel(): CharacteristicValue {
    return this.platform.cache.get().recharge?.batteryChargeLevel?.value ?? 0;
  }

  private getChargingState(): CharacteristicValue {
    const { Characteristic } = this.platform;
    const status = this.platform.cache.get().recharge?.chargingSystemStatus?.value;
    switch (status) {
      case 'CHARGING_SYSTEM_CHARGING': return Characteristic.ChargingState.CHARGING;
      case 'CHARGING_SYSTEM_FAULT': return Characteristic.ChargingState.NOT_CHARGEABLE;
      default: return Characteristic.ChargingState.NOT_CHARGING;
    }
  }

  private getLowBatteryStatus(): CharacteristicValue {
    const { Characteristic } = this.platform;
    const level = this.platform.cache.get().recharge?.batteryChargeLevel?.value ?? 100;
    return level <= LOW_BATTERY_THRESHOLD
      ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
      : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
  }
}
