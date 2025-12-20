#!/bin/bash

echo "=== Stop Autofill Extension Validator ==="
echo ""

errors=0
warnings=0

# Check required files exist
echo "Checking file structure..."

required_files=(
  "manifest.json"
  "sw.js"
  "content/apply.js"
  "content/picker.js"
  "content/picker.css"
  "ui/panel.html"
  "ui/panel.css"
  "ui/panel.js"
  "ui/confirm.html"
  "ui/confirm.css"
  "ui/confirm.js"
  "README.md"
  "LICENSE"
)

for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file"
  else
    echo "✗ MISSING: $file"
    ((errors++))
  fi
done

echo ""
echo "Checking for common issues..."

# Check for truncated files
if ! grep -q "// ---- start ----" content/apply.js 2>/dev/null; then
  echo "⚠ apply.js may be incomplete (missing startup code)"
  ((warnings++))
fi

# Check manifest version
if grep -q '"manifest_version": 3' manifest.json; then
  echo "✓ Manifest V3"
else
  echo "✗ Not using Manifest V3"
  ((errors++))
fi

# Check for unnecessary permissions
if grep -q '"windows"' manifest.json; then
  echo "⚠ Unnecessary 'windows' permission found"
  ((warnings++))
fi

# Validate JSON
echo ""
echo "Validating JSON files..."

for json_file in manifest.json; do
  if command -v jq &> /dev/null; then
    if jq empty "$json_file" 2>/dev/null; then
      echo "✓ $json_file is valid JSON"
    else
      echo "✗ $json_file has JSON syntax errors"
      ((errors++))
    fi
  else
    echo "⚠ jq not installed, skipping JSON validation"
    ((warnings++))
    break
  fi
done

# Check file sizes (detect if truncated)
echo ""
echo "Checking file sizes..."

min_sizes=(
  "content/apply.js:3000"
  "ui/panel.js:5000"
  "sw.js:4000"
)

for check in "${min_sizes[@]}"; do
  file="${check%:*}"
  min_size="${check#*:}"
  
  if [ -f "$file" ]; then
    actual_size=$(wc -c < "$file")
    if [ "$actual_size" -lt "$min_size" ]; then
      echo "⚠ $file is suspiciously small ($actual_size bytes, expected >$min_size)"
      ((warnings++))
    else
      echo "✓ $file size looks good ($actual_size bytes)"
    fi
  fi
done

# Summary
echo ""
echo "=== Validation Summary ==="
echo "Errors: $errors"
echo "Warnings: $warnings"

if [ $errors -eq 0 ]; then
  echo ""
  echo "✓ Extension structure looks good!"
  echo ""
  echo "Next steps:"
  echo "1. Open chrome://extensions/"
  echo "2. Enable 'Developer mode'"
  echo "3. Click 'Load unpacked'"
  echo "4. Select this directory: $(pwd)"
  exit 0
else
  echo ""
  echo "✗ Please fix errors before loading extension"
  exit 1
fi
