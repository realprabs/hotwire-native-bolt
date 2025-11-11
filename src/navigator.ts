import type {
	HotwireNativeAdapter,
	HotwireNavigatorContract,
	Visit,
	VisitHandler,
	VisitOptions,
} from './types'
import { canNavigate, locationWithActionIsSamePage, scrollToAnchorFromLocation, uuid } from './utils'

let nativeAdapter: HotwireNativeAdapter | null = null
let restorationIdentifier = uuid()
let currentHistoryIndex = 0
const STORAGE_KEY = 'hotwire-native-bolt:restoration-mapping'
const HISTORY_INDEX_KEY = 'hotwire-native-bolt:current-history-index'
let startVisitHandler: VisitHandler = async () => console.error('Start visit handler must be set')
let cancelVisitHandler: VisitHandler = async () => console.warn('Cancel visit handler is not set')

// Initialize currentHistoryIndex from sessionStorage if available
function initializeHistoryIndex() {
	try {
		const stored = sessionStorage.getItem(HISTORY_INDEX_KEY)
		if (stored !== null) {
			const parsed = parseInt(stored, 10)
			if (!isNaN(parsed)) {
				currentHistoryIndex = parsed
			}
		}
	} catch (e) {
		console.warn('Failed to load current history index from sessionStorage:', e)
	}
}

// Save currentHistoryIndex to sessionStorage
function saveHistoryIndex(index: number) {
	try {
		sessionStorage.setItem(HISTORY_INDEX_KEY, index.toString())
	} catch (e) {
		console.warn('Failed to save current history index to sessionStorage:', e)
	}
}

// Initialize on module load
initializeHistoryIndex()

// Save mapping for the initial page if we're at index 0
// This ensures the first page can be restored to
if (currentHistoryIndex === 0) {
	saveRestorationMapping(restorationIdentifier, 0)
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
			return handlePathCall(path, args)
		},
		get(_target, prop, _receiver) {
			if (typeof prop === 'symbol') return
			const newPath = path ? `${path}.${prop}` : `${prop}`
			return handlePathAccess(newPath)
		},
	})
}

function getStorageMapping(): Record<string, number> {
	try {
		const stored = sessionStorage.getItem(STORAGE_KEY)
		return stored ? (JSON.parse(stored) as Record<string, number>) : {}
	} catch (e) {
		console.warn('Failed to load restoration mapping from sessionStorage:', e)
		return {}
	}
}

function setStorageMapping(mapping: Record<string, number>) {
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(mapping))
	} catch (e) {
		console.warn('Failed to save restoration mapping to sessionStorage:', e)
	}
}

function saveRestorationMapping(restorationId: string, index: number) {
	const mapping = getStorageMapping()
	mapping[restorationId] = index
	setStorageMapping(mapping)
}

function getHistoryIndexForRestorationId(restorationId: string): number | undefined {
	const mapping = getStorageMapping()
	return mapping[restorationId]
}

function invalidateFutureHistory(fromIndex: number) {
	const mapping = getStorageMapping()
	const filtered = Object.fromEntries(Object.entries(mapping).filter(([, index]) => index <= fromIndex))
	setStorageMapping(filtered)
}

function waitForHistoryNavigation(): Promise<void> {
	return new Promise<void>((resolve) => {
		const onPopState = () => {
			window.removeEventListener('popstate', onPopState)
			resolve()
		}
		window.addEventListener('popstate', onPopState)
	})
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
		await startVisitHandler(this.location, this.restorationIdentifier, this.options)

		// For 'replace' action, we stay at the same index
		// For 'advance' action, we move to the next index
		if (this.options.action === 'replace') {
			// Remove any existing mapping for the current index before saving the new one
			const mapping = getStorageMapping()
			const filtered = Object.fromEntries(
				Object.entries(mapping).filter(([, index]) => index !== currentHistoryIndex)
			)
			filtered[this.restorationIdentifier] = currentHistoryIndex
			setStorageMapping(filtered)
		} else {
			currentHistoryIndex++
			saveHistoryIndex(currentHistoryIndex)
			saveRestorationMapping(this.restorationIdentifier, currentHistoryIndex)
		}

		restorationIdentifier = this.restorationIdentifier
	}
	private async restore() {
		const targetIndex = getHistoryIndexForRestorationId(this.restorationIdentifier)

		if (targetIndex === undefined) {
			console.warn(`No history index found for restorationIdentifier: ${this.restorationIdentifier}, deferring to start visit`)
			return this.startVisit()
		}

		const delta = targetIndex - currentHistoryIndex

		if (delta >= 0) {
			console.warn('Cannot navigate forward in history. Delta must be negative.')
			return this.startVisit()
		}

		// Wait for navigation to complete
		const navigationPromise = waitForHistoryNavigation()
		// Navigate back in history after listener is set up
		history.go(delta)
		await navigationPromise

		// Invalidate future history entries
		invalidateFutureHistory(targetIndex)
		currentHistoryIndex = targetIndex
		saveHistoryIndex(currentHistoryIndex)
		restorationIdentifier = this.restorationIdentifier

		await startVisitHandler(this.location, this.restorationIdentifier, this.options)
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

export function createTurbo() {
	return createNestedProxy()
}
