<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { LocalStorage } from 'shared/helpers/localStorage';
import { LOCAL_STORAGE_KEYS } from 'dashboard/constants/localStorage';
import { useInstallPrompt } from 'dashboard/composables/useInstallPrompt';

const { t } = useI18n();

const {
  deviceType,
  canInstall,
  hasNativePrompt,
  needsManualIOSInstructions,
  promptInstall,
} = useInstallPrompt();

const dismissed = ref(
  LocalStorage.get(LOCAL_STORAGE_KEYS.PWA_INSTALL_DISMISSED) === true
);

const shouldShowBanner = computed(() => canInstall.value && !dismissed.value);

const icon = computed(() =>
  deviceType.value === 'desktop' ? 'i-lucide-monitor-down' : 'i-lucide-download'
);

const message = computed(() => {
  if (needsManualIOSInstructions.value) {
    return t('GENERAL.INSTALL_APP.IOS_INSTRUCTIONS');
  }
  return deviceType.value === 'desktop'
    ? t('GENERAL.INSTALL_APP.MESSAGE_DESKTOP')
    : t('GENERAL.INSTALL_APP.MESSAGE_MOBILE');
});

const handleInstall = () => {
  if (hasNativePrompt.value) {
    promptInstall();
  }
};

const dismissBanner = () => {
  dismissed.value = true;
  LocalStorage.set(LOCAL_STORAGE_KEYS.PWA_INSTALL_DISMISSED, 'true');
};
</script>

<!-- eslint-disable-next-line vue/no-root-v-if -->
<template>
  <div
    v-if="shouldShowBanner"
    class="flex items-center justify-between gap-3 px-4 py-2 text-sm border-b bg-n-blue-3 border-n-blue-4 text-n-blue-11"
  >
    <div class="flex items-center min-w-0 gap-2">
      <span class="shrink-0 size-4" :class="icon" />
      <span class="truncate">{{ message }}</span>
    </div>
    <div class="flex items-center gap-1 shrink-0">
      <button
        v-if="hasNativePrompt"
        type="button"
        class="px-3 py-1 rounded-lg whitespace-nowrap bg-n-blue-4 hover:bg-n-blue-5"
        @click="handleInstall"
      >
        {{ $t('GENERAL.INSTALL_APP.ACTION') }}
      </button>
      <button
        type="button"
        class="grid rounded-lg size-7 place-content-center hover:bg-n-blue-4"
        :aria-label="$t('GENERAL_SETTINGS.DISMISS')"
        @click="dismissBanner"
      >
        <span class="size-4 i-lucide-x" />
      </button>
    </div>
  </div>
</template>
