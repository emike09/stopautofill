# Quick Start Guide

## Installation (5 minutes)

1. **Download the extension**
   ```bash
   # If you have the files
   cd stopautofill-fixed
   ```

2. **Load in Chrome/Edge**
   - Open `chrome://extensions/` (or `edge://extensions/`)
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `stopautofill-fixed` folder

3. **Verify installation**
   - Extension icon should appear in toolbar
   - Right-click any page → should see "Stop Autofill: Block element…"

## First Use (2 minutes)

### Block Autofill on a Website

1. Navigate to any site with forms (e.g., a login page)
2. Click the extension icon
3. Toggle "This website" to ON
4. Click "Refresh Page" button
5. Try filling the form - autocomplete should be suppressed!

### Block a Specific Form Field

1. Right-click on the page
2. Select "Stop Autofill: Block element…"
3. Hover over form fields (they'll highlight in red)
4. Click the field you want to block
5. In the popup:
   - Choose "This website" or "This page only"
   - Check which features to disable
   - Click "Save & Apply"
6. Page auto-refreshes with your changes applied

## Understanding the UI

### Popup Panel

```
┌─────────────────────────────┐
│ SAF    STOP AUTOFILL   OFF  │ ← Global status
├─────────────────────────────┤
│ This website        ○ OFF   │ ← Site-wide rule
│ example.com                 │
│                             │
│ This page           ○ OFF   │ ← Page-specific rule
│ /login                      │
│                             │
│ Disable AutoFill    ○ OFF   │ ← Feature toggles
│ Disable Password    ○ OFF   │
│ Manager                     │
├─────────────────────────────┤
│ FORMS BLOCKED               │
│                             │
│ This page      Total        │
│    0            0           │
│                             │
│ [🧱 Block Element] [Report] │
└─────────────────────────────┘
```

### Toggle States

- **Gray (○)**: Feature is OFF
- **Green (●)**: Feature is ON

### How Scopes Work

1. **"This website"** = Applies to all pages on `example.com`
2. **"This page"** = Applies only to `example.com/login`
3. **Page rule overrides site rule** when both are enabled

## Common Scenarios

### Scenario 1: Block Login Forms Site-Wide

**Problem**: Site keeps autofilling my username everywhere

**Solution**:
1. Open popup on any page of that site
2. Toggle "This website" ON
3. Both features are enabled by default
4. Refresh page

### Scenario 2: Block Only Password Field

**Problem**: Want autofill for email but not password

**Solution**:
1. Right-click → "Block element"
2. Click the password field
3. Choose "This website"
4. Check only "Disable Password Manager"
5. Uncheck "Disable AutoFill"
6. Save

### Scenario 3: Different Rules for Different Pages

**Problem**: Want to block checkout but not account settings

**Solution**:
1. On checkout page: Toggle "This page" ON
2. On account page: Leave it OFF
3. Each page follows its own rule

### Scenario 4: Remove All Blocks

**Problem**: Need to turn everything off

**Solution**:
1. Open popup
2. Toggle "This website" OFF
3. Toggle "This page" OFF
4. If you have element rules: Click "Clear"
5. Refresh page

## Troubleshooting

### "It's not working!"

**Check these**:
1. ✓ Did you refresh the page after changing rules?
2. ✓ Is the global status showing "ON"?
3. ✓ Are you on an https:// page? (doesn't work on chrome://)
4. ✓ Is the site fighting back? (some sites override autocomplete)

**Debug steps**:
1. Open DevTools (F12)
2. Inspect the form field
3. Look for `autocomplete="off"` or `autocomplete="new-password"`
4. If not there, check console for errors

### Counter Not Incrementing

**Possible reasons**:
- Forms are added dynamically after page load (wait a moment)
- No forms matched the rules (check selectors)
- Extension was disabled/updated (refresh page)

### Element Picker Not Starting

**Try**:
1. Refresh the page
2. Try the keyboard shortcut (if you add one)
3. Check that content scripts are injected:
   - DevTools → Sources → Content Scripts
   - Should see `apply.js` and `picker.js`

### Rules Not Syncing

**Note**: Sync requires:
- Chrome Sync enabled in browser settings
- Internet connection
- May take a few minutes to propagate

**Check**:
- Open `chrome://sync-internals/`
- Look for "Extension Settings" sync status

## Pro Tips

### Keyboard Shortcuts (Future)

*Not currently implemented, but you could add:*
- `Ctrl+Shift+B` - Start element picker
- `Ctrl+Shift+S` - Toggle site rule
- `Ctrl+Shift+P` - Toggle page rule

### Selector Tips

When using element picker, the extension generates selectors automatically, but you could manually edit them (future feature):

**Good selectors**:
- `#username` (ID)
- `input[name="email"]` (attribute)
- `form.login-form input[type="password"]` (context)

**Avoid**:
- `div > div > div > input` (breaks if layout changes)
- `.class123456` (generated class names)

### Performance

For best performance:
- Use site rules over many element rules
- Clear unused element rules periodically
- Avoid overly complex selectors

### Privacy

Remember:
- ✓ Only you can see your rules
- ✓ Rules sync if Chrome Sync enabled
- ✓ No form data is EVER stored
- ✓ Only stores URLs, selectors, settings

## Advanced Usage

### Export Rules (Future Feature)

*Planned*: Export all rules to JSON for backup

### Import Rules (Future Feature)

*Planned*: Share rule sets with others

### Whitelist Mode (Future Feature)

*Planned*: Block everywhere except allowed sites

## Need Help?

### Resources
- Full documentation: `README.md`
- Architecture details: `ARCHITECTURE.md`
- What was fixed: `FIXES.md`

### Common Questions

**Q: Can this break websites?**
A: Rarely. We use gentle suppression that most sites handle well. If a site breaks, just disable the rule for that site.

**Q: Does this work on all browsers?**
A: Chrome, Edge, Brave, Opera - anything Chromium-based with Manifest V3 support.

**Q: Can I block autofill globally?**
A: Not yet. Currently opt-in per site. Global blocking is planned.

**Q: Will this stop all autofill?**
A: Best-effort. Some sites actively fight autocomplete="off". We can't guarantee 100% blocking.

**Q: Does this disable password managers completely?**
A: No, just discourages them. True blocking would require OS permissions we don't have.

## Next Steps

1. ✓ Install extension
2. ✓ Try blocking on a test site
3. ✓ Experiment with element picker
4. ✓ Check stats after a few days
5. ✓ Share feedback!

## Quick Reference

| Action | Steps |
|--------|-------|
| Block entire site | Click icon → Toggle "This website" → Refresh |
| Block one page | Click icon → Toggle "This page" → Refresh |
| Block one field | Right-click → Block element → Click field → Save |
| Remove all rules | Click icon → Toggle everything OFF → Refresh |
| View stats | Click icon → See "Forms Blocked" |
| Clear element rules | Click icon → Click "Clear" button |

---

**You're all set!** 🎉

The extension is now protecting your privacy on sites where you've enabled it.
