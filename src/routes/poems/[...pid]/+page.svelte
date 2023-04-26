<script lang="ts">
	import { flow, pipe } from "fp-ts/function";
	import * as IO from "fp-ts/IO";
	import * as RA from "fp-ts/ReadonlyArray";
	import * as O from "fp-ts/Option";

	import { fade } from "svelte/transition";
	import { clientNavigate } from "$lib/history";
	import Article from "../_modules/Article.svelte";
	import Nav from "../_modules/Nav.svelte";
	import type { PageServerData} from "./$types";
	
	export let data: PageServerData;
	export let measureH: number;

	let subnavHeight: number;
	let contentHeight: number;
	let scrollRequestUpdate: boolean = false;
	
	const setPoem3 = (id: number) => (e: Event) => {
		e.preventDefault();
		data.poem = data.poems.data.filter(_ => _.id === id)[0];
		clientNavigate(true)(`/poems/${data.poem.id}`, data.poem.attributes.title);
	}
	const setPoem = (id: number) => IO.map((e: Event) => 
		pipe(
			e.preventDefault(),
			() => 
				data.poem = pipe(
					data.poems.data, 
					RA.findFirst(_ => _.id === id), 
					O.getOrElse(() => data.poems.data[0]),
				),
			() => clientNavigate(true)(`/poems/${data.poem.id}`, data.poem.attributes.title)
		)
	);
	
</script>

<svelte:head>
	<title>My Poems</title>
</svelte:head>

<section class="w-sidebar" transition:fade={{duration: 300}} bind:clientHeight={contentHeight}>
	<Article 
		poem={data.poem} 
		subnavHeight={subnavHeight}
		scrollRequestUpdate={scrollRequestUpdate}
		bind:measureH={measureH}

	/>
	<Nav 
		poems={data.poems} 
		poem={data.poem} 
		setPoem={setPoem}
		contentHeight={contentHeight}
		measureH={measureH}
		bind:subnavHeight={subnavHeight}
		bind:scrollRequestUpdate={scrollRequestUpdate}
	/>
</section>
