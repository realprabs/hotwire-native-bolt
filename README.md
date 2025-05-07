# Hotwire Native Bolt

[![CI](https://github.com/jaysson/hotwire-native-bolt/actions/workflows/main.yml/badge.svg)](https://github.com/jaysson/hotwire-native-bolt/actions/workflows/main.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/hotwire-native-bolt.svg)](https://badge.fury.io/js/hotwire-native-bolt)

A lightweight library to enable native navigation using Hotwire Native for your modern web framework based applications. You can use it with your choice of web framework like React, Vue, Svelte, etc.

## Installation

```bash
npm install hotwire-native-bolt
# or
yarn add hotwire-native-bolt
```

## Usage

### Basic Setup

```javascript
// The library automatically sets up the bridge when imported
import 'hotwire-native-bolt'

// Access the navigator
const navigator = window.HotwireNavigator

// Set up visit handlers
navigator.setStartVisitHandler(async (location, restorationId, options) => {
	// Navigate and render content
})

// Optional
navigator.setCancelVisitHandler(async (location, restorationId, options) => {
	// Handle visit cancellation
})
```

### Usage

```javascript
// Check if the navigator is enabled
const url = new URL('/path/to/page')
if (window.HotwireNavigator.canNavigate(url)) {
	// Propose a visit to the native app
	window.HotwireNavigator.visitProposedToLocation(url, { action: 'advance' })
}
```

## API Reference

- `HotwireNavigator.enabled`: Boolean indicating if a native adapter is registered
- `HotwireNavigator.canNavigate(location: URL)`: Checks if the location can be navigated to. It returns false for file URLs and external URLs. You can decide to manually handle the navigation in such cases.
- `HotwireNavigator.setStartVisitHandler(handler)`: Sets the handler for starting visits. You should use your framework's helpers to navigate in this handler.
- `HotwireNavigator.setCancelVisitHandler(handler)`: Sets the handler for cancelling visits. Optional.
- `HotwireNavigator.visitProposedToLocation(location, options)`: Proposes a visit to the native adapter. You should check if HotwireNavigator can navigate to the location before calling this method. This method will inform the native app to begin screen transitions, and the native app will then call the visit handler you set up where you would do the actual navigation.
- `HotwireNavigator.formSubmissionStarted(location)`: Notifies the app that a form submission has started
- `HotwireNavigator.formSubmissionFinished(location)`: Notifies the app that a form submission has finished
- `HotwireNative.web.send(component, event, data, callback)`: Sends a message to the native app. The callback will be called with the response from the native app.

## Contributing

Contributions are welcome! Please start a discussion if you plan to add a new feature. Once we decide that a feature is a good fit for the library, you can proceed with the following steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
