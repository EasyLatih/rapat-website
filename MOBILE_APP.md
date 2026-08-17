# RAPAT Mobile App

Hybrid iOS + Android app based on the existing RAPAT.my codebase using Capacitor.

## Current mobile features

- Existing RAPAT service search and provider directory are bundled inside the app.
- Native bottom navigation for Utama, Cari, Daftar and Kongsi.
- Native share sheet.
- Native network/offline indicator.
- Android back-button handling.
- Google OAuth opens in the system browser and returns through the app deep link.
- App ID / bundle ID: `my.rapat.app`.
- OAuth callback: `my.rapat.app://login-callback`.

## Local setup

```bash
npm install
npm run mobile:prepare
npx cap add android
npx cap add ios
npx cap sync
npm run mobile:configure
```

After the platforms exist, use:

```bash
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

## Supabase Auth setting required

Before native Google Sign-In can complete, add this Redirect URL in Supabase Auth URL Configuration:

`my.rapat.app://login-callback`

A wildcard form can also be used if needed for future callback paths:

`my.rapat.app://**`

## Apple App Store requirement before submission

RAPAT currently uses Google Sign-In for account-based rating/report functions. Before App Store submission, configure an equivalent privacy-preserving login option for iOS. Sign in with Apple is the intended implementation and requires Apple Developer credentials plus Apple provider configuration in Supabase.

## Store-release items still required

- Apple Developer account and App Store Connect app record.
- Google Play Console account and Play app record.
- Production app icons, launch/splash assets and screenshots.
- Sign in with Apple configuration for iOS.
- On-device testing on at least one iPhone and one Android device.
- Signed Android App Bundle (AAB) and signed iOS archive for store submission.
- Privacy metadata / declarations for both stores.

## CI

`.github/workflows/mobile-build.yml` builds an Android debug APK and an unsigned iOS Simulator app for engineering validation. Store builds remain unsigned until developer signing credentials are added.
