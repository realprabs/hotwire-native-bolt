import type {
	HotwireNativeAdapter,
	HotwireNavigatorContract,
	Visit,
	VisitHandler,
	VisitOptions,
} from './types'
import { canNavigate, locationWithActionIsSamePage, scrollToAnchorFromLocation, uuid } from './utils'

// ============================================================================
// Module State
// ============================================================================

let nativeAdapter: HotwireNativeAdapter | null = null
let restorationIdentifier = uuid()
let currentHistoryIndex = 0
const STORAGE_KEY = 'hotwire-native-bolt:restoration-mapping'
const HISTORY_INDEX_KEY = 'hotwire-native-bolt:current-history-index'
let startVisitHandler: VisitHandler = async () => console.error('Start visit handler must be set')
let cancelVisitHandler: VisitHandler = async () => console.warn('Cancel visit handler is not set')

// ============================================================================
// History & Restoration Management
// ============================================================================

function initializeHistoryIndex() {
	const stored = sessionStorage.getItem(HISTORY_INDEX_KEY)
	if (!stored) return

	const parsed = parseInt(stored, 10)
	if (isNaN(parsed)) return

	currentHistoryIndex = parsed
}

function saveHistoryIndex(index: number) {
	sessionStorage.setItem(HISTORY_INDEX_KEY, index.toString())
}

function getStorageMapping(): Record<string, number> {
	const stored = sessionStorage.getItem(STORAGE_KEY)
	if (!stored) return {}

	return JSON.parse(stored) as Record<string, number>
}

function setStorageMapping(mapping: Record<string, number>) {
	sessionStorage.setItem(STORAGE_KEY, JSON.stringify(mapping))
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
	const validEntries = Object.entries(mapping).filter(([, index]) => index <= fromIndex)
	const filtered = Object.fromEntries(validEntries)
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

// Initialize on module load
initializeHistoryIndex()

// Save mapping for the initial page if we're at index 0
// This ensures the first page can be restored to
if (currentHistoryIndex === 0) {
	saveRestorationMapping(restorationIdentifier, 0)
}

// ============================================================================
// Turbo Proxy (for framework compatibility)
// ============================================================================

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
			if (typeof prop === 'symbol') return undefined

			const newPath = path ? `${path}.${prop}` : `${prop}`
			return handlePathAccess(newPath)
		},
	})
}

// ============================================================================
// HotwireVisit Class
// ============================================================================

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

	async #startVisit() {
		await startVisitHandler(this.location, this.restorationIdentifier, this.options)

		if (this.options.action === 'replace') {
			this.#replaceCurrentHistoryEntry()
		} else {
			this.#advanceToNextHistoryEntry()
		}

		restorationIdentifier = this.restorationIdentifier
	}

	#replaceCurrentHistoryEntry() {
		const mapping = getStorageMapping()
		const entriesWithoutCurrent = Object.entries(mapping).filter(([, index]) => index !== currentHistoryIndex)
		const filtered = Object.fromEntries(entriesWithoutCurrent)
		filtered[this.restorationIdentifier] = currentHistoryIndex
		setStorageMapping(filtered)
	}

	#advanceToNextHistoryEntry() {
		currentHistoryIndex++
		saveHistoryIndex(currentHistoryIndex)
		saveRestorationMapping(this.restorationIdentifier, currentHistoryIndex)
	}

	async #restore() {
		const targetIndex = getHistoryIndexForRestorationId(this.restorationIdentifier)
		if (targetIndex === undefined) return this.#fallbackToStartVisit('No history index found')

		const delta = targetIndex - currentHistoryIndex
		if (delta >= 0) return this.#fallbackToStartVisit('Cannot navigate forward in history')

		await this.#navigateBackInHistory(delta)
		this.#updateHistoryState(targetIndex)
		await startVisitHandler(this.location, this.restorationIdentifier, this.options)
	}

	async #fallbackToStartVisit(reason: string) {
		console.warn(`${reason} for restorationIdentifier: ${this.restorationIdentifier}, deferring to start visit`)
		return this.#startVisit()
	}

	async #navigateBackInHistory(delta: number) {
		const navigationPromise = waitForHistoryNavigation()
		history.go(delta)
		await navigationPromise
	}

	#updateHistoryState(targetIndex: number) {
		invalidateFutureHistory(targetIndex)
		currentHistoryIndex = targetIndex
		saveHistoryIndex(currentHistoryIndex)
		restorationIdentifier = this.restorationIdentifier
	}

	issueRequest() {
		nativeAdapter?.visitRequestStarted(this)
		const operation = this.options.action === 'restore' ? this.#restore() : this.#startVisit()

		operation
			.then(this.#handleSuccessfulVisit)
			.catch(this.#handleFailedVisit)
			.finally(this.#visitCompleted)
	}

	#handleSuccessfulVisit = () => {
		nativeAdapter?.visitRequestCompleted(this)
		nativeAdapter?.visitRequestFinished(this)
		nativeAdapter?.visitRendered(this)
	}

	#handleFailedVisit = (error: unknown) => {
		const statusCode = this.#extractStatusCode(error)
		nativeAdapter?.visitRequestFailedWithStatusCode(this, statusCode)
	}

	#visitCompleted = () => {
		nativeAdapter?.visitCompleted(this)
	}

	#extractStatusCode(error: unknown): number {
		if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
			return error.status
		}
		return 500
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

// ============================================================================
// Public API
// ============================================================================

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
