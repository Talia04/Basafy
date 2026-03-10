import { NativeModules } from 'react-native';

const { UniversalLinkOpener } = NativeModules;

/**
 * Opens a URL via iOS `universalLinksOnly: true` so the OS routes it directly
 * to the registered native app (e.g. mail.google.com → Gmail).
 *
 * Returns `true`  → the URL was handled by a native app.
 * Returns `false` → no Universal Link handler found (caller should fall back
 *                   to a browser).
 *
 * On Android or if the native module is not linked, returns `false` so the
 * caller's fallback always runs.
 */
export async function openUniversalLink(url: string): Promise<boolean> {
  if (!UniversalLinkOpener?.openUniversalLink) return false;
  try {
    return await UniversalLinkOpener.openUniversalLink(url);
  } catch {
    return false;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!UniversalLinkOpener?.copyToClipboard) return false;
  try {
    return await UniversalLinkOpener.copyToClipboard(text);
  } catch {
    return false;
  }
}
