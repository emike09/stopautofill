# Icon Troubleshooting Guide

## Problem: Icons Not Showing in Extensions Page

If your extension icons aren't displaying in chrome://extensions/, here's what to try:

### Quick Fixes (Try in Order)

#### 1. Hard Reload Extension
```
1. Go to chrome://extensions/
2. Find "Stop Autofill"
3. Click the RELOAD button (circular arrow)
4. Wait 5 seconds
5. Check if icon appears
```

#### 2. Completely Remove and Reinstall
```
1. Go to chrome://extensions/
2. Click REMOVE on "Stop Autofill"
3. Close ALL browser windows (important!)
4. Reopen browser
5. Go to chrome://extensions/
6. Enable "Developer mode"
7. Click "Load unpacked"
8. Select the stopautofill-fixed folder
9. Wait 10 seconds
10. Icon should appear
```

#### 3. Clear Extension Cache
```
1. Close browser completely
2. Navigate to extension cache folder:
   
   Windows:
   %LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Extensions
   
   Or for Chrome:
   %LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions
   
3. Find folder with extension ID
4. Delete the entire folder
5. Reopen browser
6. Reinstall extension
```

#### 4. Check Icon Files Exist
```bash
# In the stopautofill-fixed folder, verify:
ls -la icons/

# Should show:
icon16.png   (920 bytes)
icon32.png   (1.5 KB)
icon48.png   (2.0 KB)
icon128.png  (4.7 KB)
```

### Verify Manifest Configuration

Open `manifest.json` and verify:

```json
{
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

### Check Browser Console

1. Open chrome://extensions/
2. Press F12 to open DevTools
3. Look for errors like:
   - "Failed to load icon"
   - "Could not load image"
   - File path errors

### Common Causes

#### Icons in Wrong Location
✅ Correct: `stopautofill-fixed/icons/icon16.png`  
❌ Wrong: `stopautofill-fixed/icon16.png`  
❌ Wrong: `stopautofill-fixed/assets/icons/icon16.png`

#### File Permissions
On Linux/Mac, ensure files are readable:
```bash
chmod 644 icons/*.png
```

#### Corrupted Icon Files
Verify icons are valid PNG files:
```bash
file icons/icon16.png
# Should output: PNG image data, 16 x 16...
```

### Still Not Working?

#### Use Default Icon Temporarily
If icons won't load, you can test without them:

1. Remove `icons` section from manifest
2. Remove `default_icon` from action
3. Reload extension
4. Will show default puzzle piece icon

#### Create New Icons
If your PNG files are corrupted:

1. Open your source images
2. Export as PNG
3. Ensure dimensions: 16x16, 32x32, 48x48, 128x128
4. Ensure transparency is preserved
5. Replace files in icons/ folder

### Debugging Steps

#### Step 1: Check Extension ID
```
1. Go to chrome://extensions/
2. Enable "Developer mode"
3. Find your extension
4. Note the ID (long string under name)
```

#### Step 2: Check Loaded Resources
```
1. Go to chrome-extension://[YOUR-ID]/icons/icon128.png
2. Replace [YOUR-ID] with actual extension ID
3. If image loads → icons are accessible
4. If 404 error → icon path is wrong
```

#### Step 3: Inspect Extension Details
```
1. Right-click extension icon in toolbar
2. Click "Manage extension"
3. Should see your icon in the details page
4. If showing default icon → check manifest
```

### Expected Results

After successful installation:

✅ **Extensions page** (chrome://extensions/)
- Should show 128px icon next to extension name
- Icon visible in card view
- Icon visible in list view

✅ **Toolbar**
- Should show 16px or 32px icon (depending on screen DPI)
- May need browser restart to appear

✅ **Extension details page**
- Should show large icon at top
- May take a few seconds to load

### Browser-Specific Issues

#### Microsoft Edge
- Sometimes caches icons aggressively
- May need to restart Edge completely
- Try clearing browser cache (Ctrl+Shift+Del)

#### Chrome
- Usually updates icons immediately
- Check chrome://extensions/ first
- Toolbar icon may lag behind

### Nuclear Option

If nothing works:

```
1. Export your rules (Settings → Export Rules)
2. Completely uninstall extension
3. Close ALL browser windows
4. Delete browser cache
5. Restart computer (yes, really)
6. Reinstall extension
7. Import rules back
```

### Getting Help

If icons still don't work, report:

1. Browser name and version
2. Operating system
3. Extension ID
4. Screenshot of chrome://extensions/
5. Console errors (if any)
6. Result of: chrome-extension://[ID]/icons/icon128.png

## Why This Happens

Browser extension icon caching is complex:

- Icons cached at multiple levels
- Cache not always cleared on reload
- Different cache for toolbar vs. extensions page
- OS-level icon caching (Windows)
- Browser profile corruption

It's frustrating but usually fixable with a complete reinstall!
