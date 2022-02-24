<script lang="ts">
  import type { StrapiArt} from "../../lib/types";
	import { cleanUrlSlug } from "./../../lib/history";
  import { apiBaseUrl } from "../../lib/api";
  import type { Tweened } from 'svelte/motion';

	export let artPieces: StrapiArt["data"]
	export let artPiece: StrapiArt["data"][number];
	export let setArtPiece: (_: number) => (e: Event) => void;

</script>
<nav>
  <div>
    <ul>
      {#each artPieces as _ (_.id)}
        <li>
          <a 
            on:click={setArtPiece(_.id)}
            href="{`/illustration/${_.id}/${cleanUrlSlug(_.attributes.title)}`}"
            class:active="{_.id === artPiece.id}" 
          >
            <img 
              src={`${apiBaseUrl}${_.attributes.image.data.attributes.formats.thumbnail.url}`} 
              alt={_.attributes.description} 
            />
          </a>
        </li>
      {/each}
    </ul>
  </div>
</nav>

<style>
  nav {
		color: var(--off-bk);
		padding: 1rem 0 1rem;
		background: var(--p-md);
    border-top: var(--space-md) solid var(--b-md);
    width: 100%;
    position: absolute;
    bottom: 0;
    display: flex;
    justify-content: center;
    align-items: center;
	}
  div {
    width: var(--wrapper-width);
    display: flex;
    justify-content: center;
  }
	ul {
		display: flex;
		list-style: none;
		padding: 0;
		font-weight: 600;
    align-items: center;
	}
	ul img {
		height: 4rem;
	}
  li {
    margin: 0 1rem;
  }
</style>