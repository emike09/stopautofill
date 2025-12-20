# Stop Autofill

A Chromium-based browser extension that gives you control over autofill behavior on websites.

## Features

- **Opt-in control**: Only affects sites/pages you explicitly enable
- **Granular rules**: Block autofill for entire sites, specific pages, or individual elements
- **Element picker**: AdBlocker-style picker to block specific form fields
- **Password manager control**: Discourage password manager suggestions (gentle approach)
- **Privacy-focused**: Never stores your form data, only stores rules and selectors

## How It Works

### Rule Scopes

The extension supports three levels of rules (in order of priority):

1. **Element rules** (most specific) - Block specific form fields using CSS selectors
2. **Page rules** - Apply to a specific URL
3. **Site rules** - Apply to an entire origin (e.g., all pages on example.com)

### Usage

#### From the Popup Panel

1. Click the extension icon to open the panel
2. Toggle "This website" to enable/disable for the entire site
3. Toggle "This page" to enable/disable for just the current page
4. Toggle individual features (AutoFill, Password Manager)

#### Block Specific Elements

1. Right-click on the page → "Stop Autofill: Block element…"
2. Click on the form field you want to block
3. Choose scope (site or page) and features to disable
4. Click "Save & Apply"

## Installation

### Development Install

1. Download/clone this repository
2. Open Chrome/Edge and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the extension directory

## How Suppression Works

The extension uses gentle, best-effort techniques:

- **Disable AutoFill**: Sets `autocomplete="off"` on forms and inputs
- **Disable Password Manager**: Sets `autocomplete="new-password"` on password fields and `autocomplete="off"` on username-like fields

Note: Some sites may fight back against these attributes. This is a gentle approach that works with most sites but isn't foolproof.

## Privacy & Storage

### What Gets Synced (chrome.storage.sync)

- All rules (site/page/element)
- User preferences
- Total forms blocked counter

If you have Chrome Sync enabled, these settings will sync across your devices.

### What Doesn't Get Synced

- Per-page counters (session storage only)
- Temporary picker state

### What Never Gets Stored

- Form values
- Autofill data
- Passwords
- Any typed text

Only stores: origins, URLs, CSS selectors, and feature flags.

## Development

### File Structure

```
stopautofill/
├── manifest.json          # Extension manifest
├── sw.js                  # Service worker (background script)
├── content/
│   ├── apply.js           # Content script that applies rules
│   ├── picker.js          # Element picker functionality
│   └── picker.css         # Picker UI styles
└── ui/
    ├── panel.html/css/js  # Popup panel
    └── confirm.html/css/js # Element block confirmation
```

### Key Technologies

- Manifest V3
- chrome.storage.sync for settings
- chrome.storage.session for temporary data
- MutationObserver for dynamic content

## Known Limitations

- Some sites actively fight autocomplete suppression
- Can't truly disable browser password managers (only discourage)
- Requires page refresh for changes to take effect
- Element selectors may break if sites change their HTML

## Website
 -[here](https://stopautofill.com)

## License

GPL-3.0 - See LICENSE file for details

## Contributing

This is a personal project but suggestions and bug reports are welcome!
