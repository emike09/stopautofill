# Stop Autofill - Architecture

## Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser Extension                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Popup UI   │    │   Content    │    │   Service    │      │
│  │  (panel.js)  │    │   Scripts    │    │   Worker     │      │
│  │              │    │  (apply.js,  │    │   (sw.js)    │      │
│  │  Ephemeral   │    │  picker.js)  │    │              │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                   │
│                    chrome.runtime.sendMessage                   │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                        Storage Layer                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────┐    ┌────────────────────────┐       │
│  │  chrome.storage.sync   │    │ chrome.storage.session │       │
│  │                        │    │                        │       │
│  │  • Rules (site/page/   │    │  • Per-page counters   │       │
│  │    element)            │    │  • Pending refresh     │       │
│  │  • User defaults       │    │  • Picker temp state   │       │
│  │  • Total stats         │    │                        │       │
│  │                        │    │  (Cleared on reload)   │       │
│  │  (Syncs across devices)│    │                        │       │
│  └────────────────────────┘    └────────────────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### User Enables a Rule

```
┌─────────┐
│  User   │ Clicks "This website" toggle
└────┬────┘
     │
     ▼
┌──────────────┐
│  panel.js    │ 1. Read current state
│              │ 2. Toggle rule.enabled
│              │ 3. Send SET_SYNC message
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   sw.js      │ 4. Save to chrome.storage.sync
│              │ 5. Send SET_PENDING_REFRESH
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  panel.js    │ 6. Show "Refresh Required" card
└──────────────┘
```

### Page Loads with Rules

```
┌──────────────┐
│ Page loads   │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  apply.js        │ 1. Check if http/https
│  (document_start)│ 2. Send GET_STATE
└──────┬───────────┘
       │
       ▼
┌──────────────┐
│   sw.js      │ 3. Query chrome.storage.sync
│              │ 4. Return rules for current URL
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  apply.js        │ 5. Apply global rules (site/page)
│                  │ 6. Apply element rules
│                  │ 7. Start MutationObserver
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  DOM             │ Forms get autocomplete="off" etc.
└──────────────────┘
```

### Element Picker Flow

```
┌─────────┐
│  User   │ Right-click → "Block element..."
└────┬────┘
     │
     ▼
┌──────────────┐
│   sw.js      │ Send PICKER_START to content script
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  picker.js   │ 1. Show overlay + toast
│              │ 2. Highlight on hover
│              │ 3. On click, generate selector
│              │ 4. Send PICKER_RESULT
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   sw.js      │ 5. Store in session storage
│              │ 6. Open confirm.html window
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ confirm.html │ 7. Load pick from session
│              │ 8. User chooses scope + features
│              │ 9. Save to sync storage
│              │ 10. Reload target tab
└──────────────┘
```

## Message Types

### From Popup → Service Worker

| Message Type | Purpose | Response |
|--------------|---------|----------|
| `GET_STATE` | Load rules for current URL | `{ ok: true, data, url, origin, pageRule, siteRule }` |
| `SET_SYNC` | Save updated rules | `{ ok: true }` |
| `SET_PENDING_REFRESH` | Mark tab needs reload | `{ ok: true }` |
| `GET_PENDING_REFRESH` | Check if tab needs reload | `{ ok: true, value }` |
| `CLEAR_PENDING_REFRESH` | Clear reload flag | `{ ok: true }` |
| `GET_PAGE_COUNT` | Get blocked forms on page | `{ ok: true, count }` |

### From Content Script → Service Worker

| Message Type | Purpose | Response |
|--------------|---------|----------|
| `GET_STATE` | Load rules for current URL | `{ ok: true, data, url, origin }` |
| `INCR_PAGE` | Increment per-page counter | `{ ok: true, count }` |
| `INCR_TOTAL` | Increment global counter | `{ ok: true, total }` |
| `PICKER_RESULT` | Element was selected | `{ ok: true }` |

### From Service Worker → Content Script

| Message Type | Purpose |
|--------------|---------|
| `PICKER_START` | Enable element picker |
| `STATE_UPDATED` | Rules changed, reapply |

### From Confirm Window → Service Worker

| Message Type | Purpose | Response |
|--------------|---------|----------|
| `GET_PENDING_PICK` | Retrieve selected element | `{ ok: true, pick }` |
| `SET_SYNC` | Save new element rule | `{ ok: true }` |

## Storage Schema

### chrome.storage.sync (key: "saf")

```javascript
{
  defaults: {
    disableAutofill: true,
    disablePasswordManager: true
  },
  
  rules: {
    // Site rules: origin → rule
    site: {
      "https://example.com": {
        enabled: true,
        disableAutofill: true,
        disablePasswordManager: true
      }
    },
    
    // Page rules: full URL → rule
    page: {
      "https://example.com/login": {
        enabled: true,
        disableAutofill: false,
        disablePasswordManager: true
      }
    },
    
    // Element rules: origin → array of rules
    element: {
      "https://example.com": [
        {
          enabled: true,
          selector: "#username",
          scope: "site",  // or "page"
          url: "https://example.com/login",  // if scope = "page"
          disableAutofill: true,
          disablePasswordManager: false
        }
      ]
    }
  },
  
  stats: {
    totalFormsBlocked: 42
  }
}
```

### chrome.storage.session

```javascript
// Per-tab refresh state
{
  "pendingRefresh:123": true,
  "pendingRefresh:456": false
}

// Per-tab page counters
{
  "pageBlockedCount:123": 5,
  "pageBlockedUrl:123": "https://example.com/page"
}

// Temporary picker state (expires quickly)
{
  "pendingPick:uuid-here": {
    pickedAt: 1234567890,
    url: "https://example.com/page",
    origin: "https://example.com",
    selector: "#username",
    tag: "input",
    isForm: false
  }
}
```

## Rule Precedence

When determining which rule applies:

```
1. Check element rules for this origin
   └─ If selector matches
      └─ If scope = "site" OR (scope = "page" AND url matches)
         └─ Apply element rule settings ✓

2. Check page rule for exact URL
   └─ If enabled
      └─ Apply page rule settings ✓

3. Check site rule for origin
   └─ If enabled
      └─ Apply site rule settings ✓

4. No rule applies → do nothing
```

## Lifecycle

### Extension Install

```
1. Service worker starts
2. Context menu created
3. Content scripts injected into all tabs (if already open)
4. Storage initialized with defaults (if first install)
```

### Tab Navigation

```
1. Page starts loading
2. content/apply.js runs (document_start)
3. GET_STATE message → service worker
4. Service worker returns rules
5. apply.js applies rules to existing DOM
6. MutationObserver watches for new elements
```

### Popup Opens

```
1. panel.html loads
2. panel.js runs
3. Query active tab
4. GET_STATE for that tab's URL
5. Render current state
6. User makes changes → SET_SYNC
7. User closes popup (or navigates away)
8. Popup state is lost (ephemeral)
```

### Extension Update/Reload

```
1. All content scripts stop
2. Service worker restarts
3. chrome.storage.sync data persists ✓
4. chrome.storage.session data CLEARED ✗
5. Tabs need refresh to reactivate
```

## Error Handling Strategy

### Content Scripts
- Fail silently if can't reach service worker
- Continue watching DOM even if initial rules fail
- Never crash the page

### Service Worker
- Validate all incoming messages
- Graceful fallback on storage errors
- Log errors but don't expose to user

### Popup
- Show loading states
- Display error messages in UI
- Allow retry on failure

### Picker
- ESC key always cancels
- Clicking outside stops picking
- Timeout after 20 seconds

## Performance Considerations

### Why document_start?

Content scripts run at `document_start` to:
- Apply rules before autocomplete attempts
- Catch dynamically-added forms immediately
- Minimize flash of unsuppressed content

### MutationObserver Throttling

The observer fires on every DOM change but:
- Queries are batched (browser optimizes querySelectorAll)
- WeakSet prevents duplicate processing
- Only processes visible, connected elements

### Storage Optimization

- Single sync key ("saf") to stay under per-item limits
- Session storage for temporary data
- Batch counter increments (don't write on every form)

## Security

### What's Stored
- ✓ CSS selectors (user-chosen)
- ✓ URLs and origins (current page)
- ✓ Feature flags (boolean settings)
- ✗ NEVER form values
- ✗ NEVER passwords
- ✗ NEVER autofill data

### Permissions
- `storage` - Required for saving rules
- `contextMenus` - Right-click "Block element"
- `tabs` - Query active tab, reload tabs
- `scripting` - Inject content scripts (unused currently, but manifest requires it)
- `<all_urls>` - Apply to any site (user-controlled)

### Content Security Policy
Default Manifest V3 CSP:
- No eval()
- No inline scripts
- All scripts from extension resources

## Testing

### Manual Test Cases

1. **Basic Toggle**
   - Open popup on a site
   - Toggle "This website" ON
   - Refresh page
   - Verify forms have autocomplete="off"

2. **Element Picker**
   - Right-click → Block element
   - Click on input field
   - Confirm selection
   - Refresh page
   - Verify that specific input is suppressed

3. **Multi-scope**
   - Enable site rule
   - Enable page rule
   - Verify page rule takes precedence
   - Disable page rule
   - Verify site rule now applies

4. **Stats**
   - Enable rules
   - Refresh page with forms
   - Open popup
   - Verify counters increment

### Edge Cases

- ✓ Navigating SPA (same-origin)
- ✓ Opening in new tab
- ✓ Multiple tabs same site
- ✓ Extension reload
- ✓ Invalid selectors
- ✓ Restricted URLs (chrome://)
- ✓ Forms added after page load

## Future Scaling

### If Usage Grows

**Storage limits hit**:
- Implement LRU cache for element rules
- Allow user to archive/delete old rules
- Compress rule data (binary encoding)

**Performance issues**:
- Debounce MutationObserver
- Use IntersectionObserver (only process visible elements)
- Background rule compilation

**Feature requests**:
- Rule import/export
- Regex URL matching
- Advanced selector builder
- Form field whitelisting
- Screenshot annotations
