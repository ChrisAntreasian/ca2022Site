

<script lang="ts">
	import { fade } from "svelte/transition";
	import SvelteMarkdown from 'svelte-markdown'

	import { contextHeightKey, rem, type LayoutElemH } from "$lib/spacing";
	import { getContext } from "svelte";

	export let poem;
	export let subnavHeight: number;

	let fadeOut = false;
	let windowHeight: number;

	const { getHeaderHeight }: LayoutElemH = getContext(contextHeightKey);

	let hhhh: number;
	$: if (hhhh) console.log(hhhh)
</script>

<svelte:window bind:innerHeight={windowHeight} />

<article 
bind:clientHeight={hhhh}
style={`
	--min-height: ${(windowHeight - getHeaderHeight()) / rem}rem;
	--snh: ${subnavHeight / rem}rem;
`}>
	<div class="wrap">
		{#key poem.id}
			<div
				class:transition={fadeOut}
				in:fade={{duration: 500, delay: 50}}
				out:fade={{duration: 300}}
				on:outrostart="{() => {fadeOut = true}}"
				on:introend="{() => {fadeOut = false}}"
			>
			Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis blandit bibendum ipsum, in euismod massa malesuada a. Interdum et malesuada fames ac ante ipsum primis in faucibus. Etiam a condimentum nibh. Integer dictum ut leo blandit rutrum. Praesent luctus consequat nulla nec vestibulum. Suspendisse ut neque vel nunc efficitur posuere. Cras vel pulvinar ipsum. Phasellus a nisi vitae nibh imperdiet vulputate id quis risus. Praesent quis tincidunt erat, vel ultricies purus
			Sed sem libero, elementum ut nisi at, semper scelerisque felis. Integer sit amet justo sagittis, scelerisque purus at, maximus ligula. Curabitur posuere luctus efficitur. In iaculis nunc vitae rutrum commodo. Suspendisse id euismod mauris. Phasellus sit amet fringilla ex. Proin pulvinar convallis urna, vel sollicitudin arcu. Suspendisse sodales sapien sed ante placerat, vitae tempor lectus sollicitudin. Aliquam nec risus vitae metus auctor tristique et in turpis. Donec malesuada nisi risus, quis laoreet tortor consequat ac. Aenean sagittis vestibulum dignissim. Duis rhoncus odio et tincidunt condimentum. Sed tincidunt fringilla varius. Proin tincidunt leo eu rhoncus aliquam.
			Vivamus luctus mattis risus, non molestie arcu facilisis sit amet. Duis efficitur massa a ligula facilisis viverra. Maecenas venenatis lectus sed lectus euismod tempor. Nulla pellentesque tortor augue, vel placerat felis vulputate vel. Fusce pulvinar mi id porttitor ornare. Interdum et malesuada fames ac ante ipsum primis in faucibus. In hendrerit, orci vitae posuere hendrerit, massa nisi fringilla mi, eu imperdiet mi tortor sed risus. Aliquam cursus mattis erat at lacinia. Cras aliquet finibus tristique.
			Morbi rutrum accumsan leo, lobortis tempor nibh porta non. Donec tincidunt porta leo vel aliquet. Suspendisse potenti. Nulla velit nunc, lobortis sed risus quis, ullamcorper malesuada eros. In hac habitasse platea dictumst. In eget faucibus diam. Pellentesque congue feugiat nisi, vitae congue ligula congue eu. Maecenas ultrices in nisi vitae varius. Praesent bibendum enim eget gravida vehicula. Nulla ac ante aliquet lectus fringilla tempus. Sed tristique ultricies tortor. Ut tristique gravida turpis, id pharetra orci lacinia sit amet. Curabitur auctor ut nulla a pretium. Nullam risus sapien, ultricies eget hendrerit non, fringilla eleifend massa. Maecenas vestibulum, nisi at finibus interdum, est neque iaculis ex, quis tincidunt felis enim vitae urna. Quisque venenatis enim vel justo tempor suscipit.
			Suspendisse at lectus iaculis, commodo urna id, maximus lectus. Donec eget ex dictum, eleifend lectus sit amet, venenatis lacus. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Nulla mauris metus, ornare sed tincidunt aliquet, suscipit eget orci. Nullam enim elit, porttitor in nisi et, dictum pharetra leo. Nam fringilla id dui at ultrices. Fusce magna metus, pharetra nec libero id, consequat suscipit ante.
			Maecenas dapibus, libero vestibulum eleifend tempor, ante ligula feugiat quam, eleifend auctor metus velit non dolor. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Curabitur nisl mi, dignissim ac dapibus ac, imperdiet vel risus. Etiam tellus lorem, auctor at rhoncus ac, aliquet auctor risus. Maecenas eu venenatis massa. Aliquam tincidunt porta felis nec suscipit. Ut porta ullamcorper placerat. Quisque id consequat enim. Morbi efficitur ipsum nec porttitor ullamcorper. Curabitur a cursus dui. Nunc porta arcu in porta consequat. Nunc ultricies ornare venenatis. Sed luctus ipsum sit amet malesuada accumsan. Nulla sodales neque viverra purus tincidunt gravida. Ut et ligula eu justo convallis dictum nec nec magna. 	
			<h3>{poem.attributes.title}</h3>
				<SvelteMarkdown source={poem.attributes.body} />
			</div>
		{/key}
	</div>
</article>

<style>
	article {
		padding: 1.3333rem 0 2rem;
		width: 66.66%;
		display: flex;
		justify-content: center;
		position: relative;
		min-height: var(--min-height);
	}
	.wrap {
		width: 66.66%;
		position: relative;
	}
	.wrap > div {
		height: 1200px;
	}
	@media (max-width: 767.98px) {
		article {
			width:100%;
			padding: 1.3333rem 1rem 2rem;
			padding-bottom: calc(var(--snh) + 2rem);

		}
		.wrap {
			width: 100%;
			max-width: 30rem;
		}
		h3 {
			display: none;
		}
	}
</style>