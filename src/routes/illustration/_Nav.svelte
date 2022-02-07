<script lang="ts">
  import type { StrapiArt} from "../../lib/types";
	import { cleanUrlSlug } from "./../../lib/history";
  import { apiBaseUrl } from "../../lib/api";

	export let artPieces: StrapiArt
	export let artPiece: StrapiArt["data"][number];
	export let setArtPiece: (_: number) => (e: Event) => void;
</script>

<nav>
  <ul>
    {#each artPieces.data as _ (_.id)}
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
</nav>

<style>
  nav {
		color: var(--off-bk);
		padding: 1rem 0;
		background: var(--md-p);
    width: 100%;
    position: absolute;
    bottom: 0;
	}
	ul {
		display: flex;
		list-style: none;
		line-height: 2rem;
		padding: 0;
		font-weight: 600;
		letter-spacing: 0.02rem;
	}
	ul img {
		height: 6rem;
	}
</style>