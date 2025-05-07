import type { HotwireNavigatorContract } from './types'
import { Bridge } from './bridge'
import { createTurbo, HotwireNavigator } from './navigator'

declare global {
	interface Window {
		HotwireNavigator: HotwireNavigatorContract
		HotwireNative: {
			web: Bridge
		}
	}
}

window.HotwireNavigator = HotwireNavigator
// @ts-expect-error We don't want to publish this type
window.Turbo = createTurbo()
if (!window.HotwireNative) {
	const webBridge = new Bridge()
	window.HotwireNative = { web: webBridge }
	webBridge.start()
}
