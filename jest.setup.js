// Expo SDK 54 installs several lazy global getters via expo/src/winter/runtime.native.ts.
// If those getters are first accessed during Jest module teardown (after require() is
// revoked), jest-runtime throws "You are trying to import a file outside of the scope
// of the test code."  Eagerly touching every one of them here, during the setupFiles
// phase (before any test code runs), resolves this issue.
void global.__ExpoImportMetaRegistry;
void global.structuredClone;
void global.TextDecoder;
void global.TextDecoderStream;
void global.TextEncoderStream;
void global.URL;
void global.URLSearchParams;
