# File Structure

```
stopautofill-fixed/
│
├── manifest.json              # Extension manifest (Manifest V3)
├── sw.js                      # Service worker (background script)
│
├── content/                   # Content scripts (injected into pages)
│   ├── apply.js               # Main rule application logic
│   ├── picker.js              # Element picker functionality
│   └── picker.css             # Picker UI styles
│
├── ui/                        # User interface
│   ├── panel.html             # Main popup HTML
│   ├── panel.css              # Popup styles
│   ├── panel.js               # Popup logic
│   ├── confirm.html           # Element block confirmation window
│   ├── confirm.css            # Confirmation styles
│   └── confirm.js             # Confirmation logic
│
├── README.md                  # Main documentation
├── QUICKSTART.md              # Quick start guide for users
├── ARCHITECTURE.md            # Technical architecture details
├── FIXES.md                   # What was broken and how it was fixed
├── CHANGELOG.md               # Version history
├── STRUCTURE.md               # This file
├── LICENSE                    # GPL-3.0 license
└── validate.sh                # Validation script (chmod +x to use)
```

## File Sizes

```
content/apply.js    ~8KB   Core suppression logic
ui/panel.js         ~9KB   Popup UI controller
sw.js              ~8KB   Background service worker
ui/confirm.js      ~2KB   Confirmation window logic
content/picker.js  ~3KB   Element picker
```

## Lines of Code

```
JavaScript:  ~1,200 lines (core functionality)
CSS:         ~300 lines (styling)
HTML:        ~150 lines (markup)
Docs:        ~2,500 lines (documentation)
```

## Critical Files

### Must Read
1. `README.md` - Start here
2. `QUICKSTART.md` - How to use it
3. `manifest.json` - Extension configuration

### For Developers
1. `ARCHITECTURE.md` - How it works
2. `FIXES.md` - What was fixed
3. `sw.js` - Message routing
4. `content/apply.js` - Core logic

### For Users
1. `QUICKSTART.md` - Get started fast
2. `README.md` - Full features
3. `CHANGELOG.md` - What's new

## Load Order

When extension loads:

1. `manifest.json` - Read by browser
2. `sw.js` - Service worker starts
3. Content scripts injected into tabs:
   - `content/apply.js` (document_start)
   - `content/picker.js` (document_start)
   - `content/picker.css`

When user clicks extension icon:
1. `ui/panel.html` opens
2. `ui/panel.css` loaded
3. `ui/panel.js` executes

When element picker used:
1. `ui/confirm.html` opens in new window
2. `ui/confirm.css` loaded
3. `ui/confirm.js` executes

## Dependencies

**Zero external dependencies!**

Uses only:
- Chrome Extensions API
- Vanilla JavaScript (ES6+)
- Standard CSS
- HTML5

No npm, no build process, no frameworks.

## Browser Compatibility

Works on:
- ✓ Chrome 88+
- ✓ Edge 88+
- ✓ Brave (Chromium-based)
- ✓ Opera (Chromium-based)

Requires:
- Manifest V3 support
- chrome.storage.sync API
- chrome.storage.session API (Chrome 102+)

## File Permissions

```bash
# Make validation script executable
chmod +x validate.sh

# All other files should be readable
chmod 644 manifest.json
chmod 644 *.js
chmod 644 *.html
chmod 644 *.css
chmod 644 *.md
```

## Size Limits

Chrome Web Store limits:
- ✓ Total uncompressed: ~20KB (well under 512KB limit)
- ✓ Manifest size: <1KB (under 4KB limit)
- ✓ No large assets
- ✓ No external scripts

Chrome sync storage limits:
- Max total: 100KB (currently using <10KB)
- Max per item: 8KB (using 1 item)
- Max writes: 1000/hour (we batch writes)

## What's NOT Included

To keep extension lean:

- ❌ No icon files (using text logo)
- ❌ No images/screenshots
- ❌ No build tools
- ❌ No package.json
- ❌ No node_modules
- ❌ No TypeScript (vanilla JS only)
- ❌ No CSS preprocessors
- ❌ No bundler (Webpack, Rollup, etc.)

## Adding Icons (Optional)

If you want to add icons later:

```
icons/
├── icon16.png
├── icon32.png
├── icon48.png
└── icon128.png
```

Then update manifest.json:
```json
{
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```
