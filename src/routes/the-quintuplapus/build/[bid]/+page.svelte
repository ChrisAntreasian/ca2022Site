<script lang="ts">
	import BuildConfirm from "$lib/BuildConfirm.svelte";
  import type { PageServerData } from "./$types";
  
  export let data: PageServerData;
</script>

<BuildConfirm title={data.title} data={data} />