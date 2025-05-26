import type { HotwireNavigatorContract } from './types'
import { Bridge } from './bridge'
import { createTurbo, HotwireNavigator } from './navigator'

declare global {
	interface Window {
		HotwireNavigator: HotwireNavigatorContract
		Strada: {
			web: Bridge
		}
		HotwireNative: {
			web: Bridge
		}
	}
}

window.HotwireNavigator = HotwireNavigator
// @ts-expect-error We don't want to publish this type
window.Turbo = createTurbo()
const webBridge = new Bridge()
if (!window.Strada) {
	window.Strada = { web: webBridge }
}
if (!window.HotwireNative) {
	window.HotwireNative = {
		web: webBridge,
	}
}
webBridge.start()
