/**
 * @file useInstallPrompt.js
 * @description A composable that exposes "install as app" (PWA) state and
 * actions: capturing the browser's native install prompt where supported
 * (Chrome/Edge on Android and desktop), and detecting the iOS Safari case
 * where no native prompt exists and manual "Add to Home Screen" steps must
 * be shown instead. Works the same way on phones, tablets and desktop.
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import wootConstants from 'dashboard/constants/globals';

const deferredPrompt = ref(null);
const isStandalone = ref(false);
const installOutcome = ref(null);

const detectStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const detectIOS = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;

const handleBeforeInstallPrompt = event => {
  // Chrome/Edge fire this instead of showing their own mini-infobar when we
  // call preventDefault, so we can trigger it later from our own UI.
  event.preventDefault();
  deferredPrompt.value = event;
};

const handleAppInstalled = () => {
  deferredPrompt.value = null;
  isStandalone.value = true;
};

let listenerCount = 0;

export const useInstallPrompt = () => {
  const isIOS = ref(detectIOS());

  onMounted(() => {
    isStandalone.value = detectStandalone();

    if (listenerCount === 0) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
    }
    listenerCount += 1;
  });

  onUnmounted(() => {
    listenerCount -= 1;
    if (listenerCount === 0) {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    }
  });

  const deviceType = computed(() => {
    const width = window.innerWidth;
    if (width < wootConstants.SMALL_SCREEN_BREAKPOINT) return 'mobile';
    if (width < wootConstants.LARGE_SCREEN_BREAKPOINT) return 'tablet';
    return 'desktop';
  });

  // Chrome/Edge (any device): a real, one-tap native install.
  const hasNativePrompt = computed(() => Boolean(deferredPrompt.value));
  // iOS Safari never fires beforeinstallprompt; only manual steps exist there.
  const needsManualIOSInstructions = computed(
    () => isIOS.value && !isStandalone.value && !hasNativePrompt.value
  );

  const canInstall = computed(
    () =>
      !isStandalone.value &&
      (hasNativePrompt.value || needsManualIOSInstructions.value)
  );

  const promptInstall = async () => {
    if (!deferredPrompt.value) return null;

    deferredPrompt.value.prompt();
    const { outcome } = await deferredPrompt.value.userChoice;
    installOutcome.value = outcome;
    deferredPrompt.value = null;
    return outcome;
  };

  return {
    deviceType,
    isStandalone,
    isIOS,
    hasNativePrompt,
    needsManualIOSInstructions,
    canInstall,
    promptInstall,
  };
};

export default useInstallPrompt;
