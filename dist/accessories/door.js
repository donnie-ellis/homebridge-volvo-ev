"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoorAccessory = void 0;
class DoorAccessory {
    constructor(platform, accessory, doorKey) {
        this.platform = platform;
        this.doorKey = doorKey;
        const { Service, Characteristic } = platform;
        accessory
            .getService(Service.AccessoryInformation)
            ?.setCharacteristic(Characteristic.Manufacturer, 'Volvo')
            .setCharacteristic(Characteristic.Model, 'Connected Vehicle');
        this.service =
            accessory.getService(Service.ContactSensor) ??
                accessory.addService(Service.ContactSensor);
        this.service
            .getCharacteristic(Characteristic.ContactSensorState)
            .onGet(() => this.getContactState());
    }
    getContactState() {
        const { Characteristic } = this.platform;
        const status = this.platform.cache.get().doors?.[this.doorKey]?.value;
        return status === 'CLOSED'
            ? Characteristic.ContactSensorState.CONTACT_DETECTED
            : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
    }
}
exports.DoorAccessory = DoorAccessory;
//# sourceMappingURL=door.js.map