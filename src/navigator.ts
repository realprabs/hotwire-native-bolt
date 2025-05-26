import type {
	HotwireNativeAdapter,
	HotwireNavigatorContract,
	ScrollPositions,
	Visit,
	VisitHandler,
	VisitOptions,
} from './types'
import { canNavigate, locationWithActionIsSamePage, scrollToAnchorFromLocation, uuid } from './utils'

let nativeAdapter: HotwireNativeAdapter | null = null
let restorationIdentifier = uuid()
const scrollPositions = new Map<string, ScrollPositions>()
let startVisitHandler: VisitHandler = async () => console.error('Start visit handler must be set')
let cancelVisitHandler: VisitHandler = async () => console.warn('Cancel visit handler is not set')

export const HotwireNavigator: HotwireNavigatorContract = {
	canNavigate,
	get enabled() {
		return !!nativeAdapter
	},
	setStartVisitHandler(handler: VisitHandler) {
		startVisitHandler = handler
	},
	setCancelVisitHandler(handler) {
		cancelVisitHandler = handler
	},
	visitProposedToLocation(location, options) {
		nativeAdapter?.visitProposedToLocation(location, {
			action: options?.action ?? 'advance',
		})
	},
	formSubmissionStarted(location: URL) {
		nativeAdapter?.formSubmissionStarted({ location })
	},
	formSubmissionFinished(location: URL) {
		nativeAdapter?.formSubmissionFinished({ location })
	},
}

function handlePathCall(functionPath: string, args: unknown[]) {
	switch (functionPath) {
		case 'registerAdapter': {
			nativeAdapter = args[0] as HotwireNativeAdapter
			break
		}
		case 'navigator.locationWithActionIsSamePage': {
			return locationWithActionIsSamePage(args[0] as URL)
		}
		case 'navigator.startVisit': {
			const visit = new HotwireVisit(new URL(args[0] as string), args[1] as string, args[2] as VisitOptions)
			return nativeAdapter?.visitStarted(visit)
		}
		case 'navigator.view.scrollToAnchorFromLocation': {
			scrollToAnchorFromLocation(args[0] as URL)
			break
		}
	}
	return undefined
}

function handlePathAccess(path: string): unknown {
	switch (path) {
		case 'navigator.restorationIdentifier': {
			return restorationIdentifier
		}
		case 'navigator.location': {
			return window.location
		}
	}
	return createNestedProxy(path)
}

function createNestedProxy(path: string = '') {
	return new Proxy(function () {}, {
		apply(_target, _thisArg, args) {
			handlePathCall(path, args)
		},
		get(_target, prop, _receiver) {
			if (typeof prop === 'symbol') return
			const newPath = path ? `${path}.${prop}` : `${prop}`
			return handlePathAccess(newPath)
		},
	})
}

function storeScrollPositions(restorationIdentifier: string) {
	const elementScrollPositions: ScrollPositions = new Map()
	elementScrollPositions.set('html', [document.documentElement.scrollLeft, document.documentElement.scrollTop])
	document.querySelectorAll('[data-scroll-id]').forEach((element) => {
		const left = element.scrollLeft
		const top = element.scrollTop
		const scrollId = (element as HTMLElement).dataset['scroll-id']
		if (scrollId) {
			elementScrollPositions.set(`[data-scroll-id="${scrollId}"]`, [left, top])
		}
	})
	scrollPositions.set(restorationIdentifier, elementScrollPositions)
}

function restoreScrollPositions(restorationIdentifier: string) {
	const elementScrollPositions = scrollPositions.get(restorationIdentifier)
	elementScrollPositions?.forEach(([left, top], selector) => {
		document.querySelector(selector)?.scrollTo({ left, top })
	})
	scrollPositions.delete(restorationIdentifier)
}

class HotwireVisit implements Visit {
	identifier = uuid()
	options: VisitOptions
	hasCachedSnapshot() {
		return true
	}
	isPageRefresh: boolean
	restorationIdentifier: string
	constructor(
		public location: URL,
		restorationIdentifier = '',
		options: VisitOptions = { action: 'advance' }
	) {
		this.restorationIdentifier = restorationIdentifier || uuid()
		this.options = options
		this.isPageRefresh = options.action === 'replace'
	}
	private async startVisit() {
		storeScrollPositions(restorationIdentifier)
		await startVisitHandler(this.location, this.restorationIdentifier, this.options)
		restorationIdentifier = this.restorationIdentifier
	}
	private async restore() {
		await this.startVisit()
		restoreScrollPositions(this.restorationIdentifier)
	}
	issueRequest() {
		nativeAdapter?.visitRequestStarted(this)
		const operation = this.options.action === 'restore' ? this.restore() : this.startVisit()
		operation
			.then(() => {
				nativeAdapter?.visitRequestCompleted(this)
				nativeAdapter?.visitRequestFinished(this)
				nativeAdapter?.visitRendered(this)
			})
			.catch((e) => {
				let statusCode = 500
				if ('status' in e && typeof e.status === 'number') {
					statusCode = e.status
				}
				nativeAdapter?.visitRequestFailedWithStatusCode(this, statusCode)
			})
			.finally(() => {
				nativeAdapter?.visitCompleted(this)
			})
	}
	// Frameworks like sveltekit and nextjs manage their own history and snapshots.
	changeHistory() {
		// Noop
	}
	loadCachedSnapshot() {
		// Noop
	}
	loadResponse() {
		// Noop
	}
	cancel() {
		return cancelVisitHandler(this.location, this.restorationIdentifier, this.options)
	}
}

export function createTurbo() {
	return createNestedProxy()
}
