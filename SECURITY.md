# Security Policy

## Supported Versions

Security updates are provided for the most recent released version of Stop Autofill.

| Version | Supported |
| ------- | --------- |
| Latest release | :white_check_mark: |
| Older versions | :x: |

Users are encouraged to keep the extension up to date to ensure they receive the latest security fixes and improvements.

---

## Reporting a Vulnerability

If you believe you have found a security vulnerability in Stop Autofill, please report it responsibly.

### How to report
- **Preferred:** Open a private security report via GitHub Security Advisories (if available), or
- **Alternative:** Email the maintainer directly at  
  **contact@stopautofill.com**

Please include:
- A clear description of the issue
- Steps to reproduce (if applicable)
- Any relevant screenshots, logs, or proof-of-concept code
- The affected browser(s) and extension version

### What to expect
- You should receive an acknowledgment within **72 hours**
- If the report is accepted, we will work to assess impact and release a fix as quickly as possible
- You may be credited for the disclosure if you wish

### Disclosure guidelines
- Please do **not** publicly disclose vulnerabilities before a fix is released
- Please do **not** exploit vulnerabilities beyond what is necessary to demonstrate the issue

---

## Scope

The following are considered in scope:
- Extension logic (background/service worker, content scripts, UI)
- Permission usage and privilege boundaries
- Rule storage, import/export, and sync behavior
- Context menu and element picker functionality

The following are out of scope:
- Vulnerabilities in underlying browsers
- Issues caused by user-modified builds
- Social engineering or physical access attacks

---

## Data & Privacy Notes

Stop Autofill:
- Does **not** collect personal data
- Does **not** transmit data to external servers
- Stores only user-created rules and settings locally (with optional browser sync)

For more details, see the [Privacy Policy](https://stopautofill.com/privacy.html).

---

Thank you for helping keep Stop Autofill secure.
