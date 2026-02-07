/**
 * Splash Screen utility
 * Controls splash screen visibility during app initialization
 */
import * as SplashScreen from 'expo-splash-screen';

// Prevent auto-hide so we can control it manually
SplashScreen.preventAutoHideAsync().catch(() => {
    // Ignore errors - splash screen may already be hidden
});

/**
 * Hide the splash screen
 * Call this after your app has finished loading essential data
 */
export async function hideSplashScreen(): Promise<void> {
    try {
        await SplashScreen.hideAsync();
    } catch (error) {
        // Ignore errors - splash screen may already be hidden
        console.debug('[SplashScreen] Hide error (may be already hidden):', error);
    }
}

/**
 * Keep splash screen visible
 * Call this at the start of your app to prevent auto-hide
 */
export async function keepSplashScreenVisible(): Promise<void> {
    try {
        await SplashScreen.preventAutoHideAsync();
    } catch (error) {
        // Ignore errors
    }
}

export default {
    hide: hideSplashScreen,
    keep: keepSplashScreenVisible,
};
