<!--
//
// Copyright © 2023 Hardcore Engineering Inc.
//
-->
<script lang="ts">
  const payload = { type: 'huly:integration-oauth-done' }
  try {
    localStorage.setItem('huly:integration-oauth-done', String(Date.now()))
  } catch {
    // ignore
  }
  try {
    window.opener?.postMessage(payload, window.location.origin)
  } catch {
    // ignore
  }
  try {
    const channel = new BroadcastChannel('huly-integrations')
    channel.postMessage(payload)
    channel.close()
  } catch {
    // ignore
  }
  window.close()
</script>
