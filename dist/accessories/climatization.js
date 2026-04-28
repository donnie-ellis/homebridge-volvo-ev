"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClimatizationAccessory = void 0;
class ClimatizationAccessory {
    constructor(platform, accessory) {
        this.platform = platform;
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
    getOn() {
        const status = this.platform.cache.get().engine?.status?.value;
        return status === 'RUNNING';
    }
    async setOn(value) {
        try {
            if (value) {
                await this.platform.api.startClimatization();
                this.platform.log.info('Climatization started.');
            }
            else {
                await this.platform.api.stopClimatization();
                this.platform.log.info('Climatization stopped.');
            }
            await this.platform.refreshCache();
        }
        catch (err) {
            this.platform.log.error('Climatization command failed:', err);
            throw err;
        }
    }
}
exports.ClimatizationAccessory = ClimatizationAccessory;
//# sourceMappingURL=climatization.js.map