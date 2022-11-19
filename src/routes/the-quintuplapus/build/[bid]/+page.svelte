<script lang="ts">
	import BuildConfirm from "$lib/BuildConfirm.svelte";
  import type { PageServerData } from ".svelte-kit/types/src/routes/the-quintuplapus/build/[bid]/$types";
  
  export let data: PageServerData;
</script>

<BuildConfirm title={data.title} data={data} />