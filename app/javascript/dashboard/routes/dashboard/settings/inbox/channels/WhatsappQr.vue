<script setup>
import { ref, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAlert } from 'dashboard/composables';
import { useStore } from 'dashboard/composables/store';

import PageHeader from '../../SettingsSubPageHeader.vue';
import Input from 'dashboard/components-next/input/Input.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';
import inboxWhatsappQrAPI from 'dashboard/api/inboxWhatsappQr';

// Internal Docker network address of the whatsapp-qr service (see
// services/whatsapp-qr and docker-compose.production.yaml) — never reached
// directly by the browser, only used by Rails when relaying agent replies.
const WEBHOOK_URL = 'http://whatsapp_qr:3001/webhook';
const POLL_INTERVAL_MS = 3000;

const { t } = useI18n();
const store = useStore();
const router = useRouter();

const step = ref('name'); // name | linking
const channelName = ref('');
const nameError = ref('');
const isCreating = ref(false);

const inbox = ref(null);
const connectionStatus = ref('connecting'); // connecting | qr | connected | unreachable
const qrDataUrl = ref(null);
const phoneNumber = ref(null);
let pollTimer = null;

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

const pollStatus = async () => {
  try {
    const { data } = await inboxWhatsappQrAPI.getStatus(inbox.value.id);
    connectionStatus.value = data.status;
    qrDataUrl.value = data.qr;
    phoneNumber.value = data.phoneNumber;
    if (data.status === 'connected') stopPolling();
  } catch (error) {
    connectionStatus.value = 'unreachable';
    stopPolling();
  }
};

const linkInbox = async () => {
  try {
    await inboxWhatsappQrAPI.link(inbox.value.id);
    pollStatus();
    pollTimer = setInterval(pollStatus, POLL_INTERVAL_MS);
  } catch (error) {
    connectionStatus.value = 'unreachable';
  }
};

const createInbox = async () => {
  const name = channelName.value.trim();
  if (!name) {
    nameError.value = t('INBOX_MGMT.ADD.WHATSAPP_QR.CHANNEL_NAME.ERROR');
    return;
  }
  nameError.value = '';
  isCreating.value = true;

  try {
    inbox.value = await store.dispatch('inboxes/createChannel', {
      name,
      channel: { type: 'api', webhook_url: WEBHOOK_URL },
    });
    step.value = 'linking';
    await linkInbox();
  } catch (error) {
    useAlert(error.message || t('INBOX_MGMT.ADD.WHATSAPP_QR.ERROR_MESSAGE'));
  } finally {
    isCreating.value = false;
  }
};

const continueToAgents = () => {
  router.replace({
    name: 'settings_inboxes_add_agents',
    params: { page: 'new', inbox_id: inbox.value.id },
  });
};

onBeforeUnmount(stopPolling);
</script>

<template>
  <div class="h-full w-full p-6 col-span-6">
    <PageHeader
      :header-title="$t('INBOX_MGMT.ADD.WHATSAPP_QR.TITLE')"
      :header-content="$t('INBOX_MGMT.ADD.WHATSAPP_QR.DESC')"
    />

    <form
      v-if="step === 'name'"
      class="flex flex-wrap flex-col mx-0"
      @submit.prevent="createInbox"
    >
      <div class="flex-shrink-0 flex-grow-0 w-full">
        <Input
          v-model="channelName"
          :label="$t('INBOX_MGMT.ADD.WHATSAPP_QR.CHANNEL_NAME.LABEL')"
          :placeholder="
            $t('INBOX_MGMT.ADD.WHATSAPP_QR.CHANNEL_NAME.PLACEHOLDER')
          "
          :message="nameError"
          :message-type="nameError ? 'error' : 'info'"
        />
      </div>

      <div class="w-full mt-4">
        <NextButton
          :is-loading="isCreating"
          type="submit"
          solid
          blue
          :label="$t('INBOX_MGMT.ADD.WHATSAPP_QR.SUBMIT_BUTTON')"
        />
      </div>
    </form>

    <div v-else class="flex flex-col items-center gap-4 py-6 text-center">
      <h3 class="text-lg font-medium text-n-slate-12">
        {{ $t('INBOX_MGMT.ADD.WHATSAPP_QR.LINKING.TITLE') }}
      </h3>

      <template v-if="connectionStatus === 'unreachable'">
        <p class="max-w-sm text-sm text-n-ruby-11">
          {{ $t('INBOX_MGMT.ADD.WHATSAPP_QR.LINKING.UNREACHABLE') }}
        </p>
      </template>

      <template v-else-if="connectionStatus === 'connected'">
        <p class="text-base font-medium text-n-teal-11">
          {{ $t('INBOX_MGMT.ADD.WHATSAPP_QR.LINKING.CONNECTED_TITLE') }}
        </p>
        <p class="text-sm text-n-slate-11">
          {{
            $t('INBOX_MGMT.ADD.WHATSAPP_QR.LINKING.CONNECTED_SUBTITLE', {
              phoneNumber,
            })
          }}
        </p>
        <NextButton
          solid
          blue
          :label="$t('INBOX_MGMT.ADD.WHATSAPP_QR.LINKING.CONTINUE_BUTTON')"
          @click="continueToAgents"
        />
      </template>

      <template v-else-if="connectionStatus === 'qr' && qrDataUrl">
        <img
          :src="qrDataUrl"
          alt="WhatsApp QR code"
          class="border rounded-lg size-56 border-n-weak"
        />
        <p class="max-w-sm text-sm text-n-slate-11">
          {{ $t('INBOX_MGMT.ADD.WHATSAPP_QR.LINKING.SCAN_INSTRUCTIONS') }}
        </p>
        <p class="max-w-sm text-xs text-n-slate-10">
          {{ $t('INBOX_MGMT.ADD.WHATSAPP_QR.LINKING.REFRESH_HINT') }}
        </p>
      </template>

      <template v-else>
        <span
          class="rounded-full size-8 border-2 border-n-slate-6 border-t-n-blue-9 animate-spin"
        />
        <p class="text-sm text-n-slate-11">
          {{ $t('INBOX_MGMT.ADD.WHATSAPP_QR.LINKING.WAITING') }}
        </p>
      </template>
    </div>
  </div>
</template>
