type ScrollLeft = number
type ScrollTop = number
type ScrollPosition = [ScrollLeft, ScrollTop]
type Selector = string

export type JSONValue = string | number | boolean | null | JSONObject | JSONArray

interface JSONObject {
	[key: string]: JSONValue
}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface JSONArray extends Array<JSONValue> {}

export type ScrollPositions = Map<Selector, ScrollPosition>
export type VisitHandler = (location: URL, restorationIdentifier: string, options: VisitOptions) => Promise<unknown>

export interface HotwireNavigatorContract {
	enabled: boolean
	canNavigate(location: URL): boolean
	setStartVisitHandler(handler: VisitHandler): unknown
	setCancelVisitHandler(
		handler: (location: URL, restorationIdentifier: string, options: VisitOptions) => Promise<unknown>
	): unknown
	visitProposedToLocation(location: URL, options?: { action?: VisitOptions['action'] }): unknown
	formSubmissionStarted(location: URL): unknown
	formSubmissionFinished(location: URL): unknown
}
export interface VisitOptions {
	action: 'advance' | 'replace' | 'restore'
}
export interface Visit {
	restorationIdentifier: string
	identifier: string
	hasCachedSnapshot(): boolean
	isPageRefresh: boolean
	issueRequest(): unknown
	changeHistory(): unknown
	loadCachedSnapshot(): unknown
	loadResponse(): unknown
	cancel(): unknown
}
export interface FormSubmission {
	location: URL
}
export interface HotwireNativeAdapter {
	currentVisit: Visit
	visitProposedToLocation(location: URL, options: VisitOptions): unknown
	visitStarted(visit: Visit): unknown
	visitRequestStarted(visit: Visit): unknown
	visitRequestCompleted(visit: Visit): unknown
	visitRequestFailedWithStatusCode(visit: Visit, statusCode: number): unknown
	visitRequestFinished(visit: Visit): unknown
	visitRendered(visit: Visit): unknown
	visitCompleted(visit: Visit): unknown
	formSubmissionStarted(formSubmission: FormSubmission): unknown
	formSubmissionFinished(formSubmission: FormSubmission): unknown
	pageInvalidated(): unknown
	linkPrefetchingIsEnabledForLocation(location: URL): boolean
	log(message: string): unknown
}
export interface BridgeMessage {
	id?: string
	component: string
	event: string
	data?: JSONObject
	callback?: BridgeMessageCallback
}
export interface BridgeAdapter {
	platform: string
	supportedComponents: string[]
	supportsComponent(component: string): boolean
	receive(message: BridgeMessage): boolean
}
export type BridgeMessageCallback = (message: Omit<BridgeMessage, 'callback'>) => unknown
