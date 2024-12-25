<script lang="ts">
	import BuildConfirm from "$lib/BuildConfirm.svelte";
  import type { PageServerData } from "./$types";
  
  interface Props {
    data: PageServerData;
  }

  let { data }: Props = $props();
</script>

<BuildConfirm title={data.title} data={data} />