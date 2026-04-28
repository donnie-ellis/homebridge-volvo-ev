import { API } from 'homebridge';
import { VolvoPlatform } from './platform.js';

export const PLUGIN_NAME = 'homebridge-volvo-ev';
export const PLATFORM_NAME = 'VolvoEV';

export default (api: API): void => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, VolvoPlatform as never);
};
