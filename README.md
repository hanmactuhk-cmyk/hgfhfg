# G-Labs Flow Automation

Browser automation for Google Flow using manually authenticated Chrome profiles. This project does not collect Gmail passwords.

## How it works
1. Install Node.js 20+ and Google Chrome.
2. `npm install`
3. `npm start`
4. Open **Tài khoản Flow** and add profiles.
5. Click **Đăng nhập / Mở** for each profile and manually sign in to Google/Flow.
6. Return to **Flow Video**, add prompts and run the queue.

Profiles are stored in Electron's userData directory and persist between app restarts.

## Important
- The Flow UI is dynamic and Google can change DOM structure. Selectors are isolated in `automation/flow-selectors.json` and the runner uses fallback selectors and polling.
- This project intentionally does not automate Gmail passwords or bypass CAPTCHA/2FA.
- Credit detection is represented as a configurable threshold in settings; actual Flow UI credit extraction may require selector updates as Google changes the account UI.
- Download detection uses Flow's visible Download controls. If Flow changes its download UI, update `flow-selectors.json`.

## Windows build
`npm run dist`

Or use GitHub Actions in `.github/workflows/build.yml`.
