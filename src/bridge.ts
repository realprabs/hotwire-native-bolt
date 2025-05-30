import type { BridgeAdapter, BridgeMessage, BridgeMessageCallback } from './types'

export class Bridge {
	#adapter: BridgeAdapter | null
	#lastMessageId: number
	#pendingMessages: BridgeMessage[]
	#pendingCallbacks: Map<string, BridgeMessageCallback>

	constructor() {
		this.#adapter = null
		this.#lastMessageId = 0
		this.#pendingMessages = []
		this.#pendingCallbacks = new Map()
	}

	start() {
		this.notifyApplicationAfterStart()
	}

	notifyApplicationAfterStart() {
		document.dispatchEvent(new Event('web-bridge:ready'))
	}

	supportsComponent(component: string) {
		if (this.#adapter) {
			return this.#adapter.supportsComponent(component)
		} else {
			return false
		}
	}

	send({ component, event, data, callback }: BridgeMessage) {
		if (!this.#adapter) {
			this.#savePendingMessage({ component, event, data, callback })
			return null
		}

		if (!this.supportsComponent(component)) return null

		const id = this.generateMessageId()
		const message = {
			id: id,
			component: component,
			event: event,
			data: {
				...data,
				metadata: {
					url: window.location.href
				}
			},
		}
		this.#adapter.receive(message)

		if (callback) {
			this.#pendingCallbacks.set(id, callback)
		}

		return id
	}

	receive(message: BridgeMessage) {
		this.executeCallbackFor(message)
	}

	executeCallbackFor(message: BridgeMessage) {
		const callback = this.#pendingCallbacks.get(message.id!)
		if (callback) {
			callback(message)
		}
	}

	removeCallbackFor(messageId: string) {
		if (this.#pendingCallbacks.has(messageId)) {
			this.#pendingCallbacks.delete(messageId)
		}
	}

	removePendingMessagesFor(component: string) {
		this.#pendingMessages = this.#pendingMessages.filter((message) => message.component !== component)
	}

	generateMessageId() {
		const id = ++this.#lastMessageId
		return id.toString()
	}

	setAdapter(adapter: BridgeAdapter) {
		this.#adapter = adapter

		// Configure <html> attributes
		document.documentElement.dataset.bridgePlatform = this.#adapter.platform
		this.adapterDidUpdateSupportedComponents()
		this.#sendPendingMessages()
	}

	adapterDidUpdateSupportedComponents() {
		if (this.#adapter) {
			document.documentElement.dataset.bridgeComponents = this.#adapter.supportedComponents.join(' ')
		}
	}

	#savePendingMessage(message: Omit<BridgeMessage, 'id'> & { callback?: BridgeMessageCallback }) {
		this.#pendingMessages.push(message)
	}

	#sendPendingMessages() {
		this.#pendingMessages.forEach((message) => this.send(message))
		this.#pendingMessages = []
	}
}
