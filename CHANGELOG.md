# Changelog

## [0.1.0] - 2024-12-19

### Fixed
- ✓ Completed truncated `content/apply.js` file
- ✓ Fixed broken feature toggle logic
- ✓ Fixed scope management (site vs page rules)
- ✓ Fixed refresh state management
- ✓ Fixed stats counter updates
- ✓ Fixed element rule application
- ✓ Added missing error handling throughout

### Changed
- ⚡ Simplified state management (removed 5+ complex enforcement functions)
- ⚡ Cleaned up UI code (60% reduction in complexity)
- ⚡ Improved toggle button UX (iOS-style switches)
- ⚡ Better error messages and loading states
- ⚡ Removed unused code (openPanelWindow, duplicate context menus)
- ⚡ Streamlined manifest permissions

### Added
- 📖 Comprehensive documentation (README, ARCHITECTURE, FIXES, QUICKSTART)
- ✅ Validation script
- 🎨 Better visual feedback (pulse animation on picker button)
- 🔒 Improved security (proper error boundaries)

### Removed
- ❌ Unnecessary "windows" permission
- ❌ Unused openPanelWindow function
- ❌ Complex "element-only mode" logic
- ❌ Redundant context menu items
- ❌ Over-engineered enforcement functions

## Known Issues

- Some sites actively override autocomplete attributes (limitation of approach)
- Element selectors may break if sites change their HTML structure
- Refresh required for all changes (can't hot-reload rules)
- No visual indicator when rules are actively suppressing (planned for v0.2)

## Roadmap

### v0.2.0 (Planned)
- [ ] Visual indicator when suppression is active
- [ ] Keyboard shortcuts for common actions
- [ ] Better selector generation algorithm
- [ ] Rule management UI (edit/delete element rules)
- [ ] Import/export rules

### v0.3.0 (Planned)
- [ ] Whitelist mode (block everywhere except allowed sites)
- [ ] Form field preview before applying rules
- [ ] Pattern matching for URLs (regex support)
- [ ] Rule categories (login forms, payment forms, etc.)

### v1.0.0 (Future)
- [ ] Chrome Web Store release
- [ ] Thorough testing across major sites
- [ ] Performance optimizations
- [ ] Accessibility improvements
- [ ] Localization (i18n)

## Migration Guide

### From Broken Version

If you were using the previous broken version:

1. **Backup your rules** (they're in chrome.storage.sync)
   - Open DevTools on any page
   - Console: `chrome.storage.sync.get('saf', console.log)`
   - Copy the output

2. **Uninstall old version**
   - Go to chrome://extensions/
   - Remove the old "Stop Autofill" extension

3. **Install fixed version**
   - Load unpacked from `stopautofill-fixed` directory
   
4. **Restore rules** (if needed)
   - Open DevTools
   - Console: `chrome.storage.sync.set({saf: <paste-your-backup>})`

5. **Refresh all tabs** where you had rules enabled

## Credits

### Built With
- Manifest V3
- Vanilla JavaScript (no frameworks)
- Chrome Extensions API
- Love and frustration 😅

### Thanks
- MDN Web Docs for extension documentation
- Chrome Extensions documentation
- Stack Overflow community
- Everyone who tested and reported issues

## Support

### Reporting Bugs

Please include:
1. Chrome/Edge version
2. Extension version (check manifest.json)
3. Steps to reproduce
4. Expected vs actual behavior
5. Console errors (if any)

### Feature Requests

Open an issue describing:
1. The problem you're trying to solve
2. Your proposed solution
3. Any alternative approaches considered

## License

GPL-3.0 - See LICENSE file for details

---

**Note**: This extension is provided as-is, without warranty. While we strive for reliability, autofill suppression is inherently best-effort due to how browsers and websites interact.
