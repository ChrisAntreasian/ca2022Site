<script lang="ts">
  import { fade } from "svelte/transition";
  import type { StrapiArt} from "$lib/types";
	import { cleanUrlSlug } from "$lib/history";
  import { apiBaseUrl } from "$lib/api";
  import Arrow from "$lib/Arrow.svelte"

  export let artPieces: StrapiArt["data"]
	export let artPiece: StrapiArt["data"][number];
	export let navArtPieceClick: (_: number) => (e: Event) => void;

  const itemsDisplayed = 10;
  const artPiecesOrdered: Array<StrapiArt["data"]> = artPieces.reduce((acc, curr: StrapiArt["data"][0], i, self) => 
    !(i % itemsDisplayed)
      ? [ ...acc, self.slice(i, i + itemsDisplayed)] 
      : acc
  , []);

  let activePage = 0;
  const paginate = (n: number) => {
    console.log("paginate")
    activePage = activePage + n
  };

</script>
<nav>
  <div class="wrap">
    {#if activePage !== 0}
      <div class="last" on:click={() => paginate(-1)}>
        <Arrow direction="left" color="white" size="large" />
      </div>
    {/if}
      {#each artPiecesOrdered as apo, i}
        <ul style={`
          margin-left: ${i * 200 - activePage * 200}%;
          opacity: ${i === activePage ? 1 : 0}
        `}>
          {#each apo as _ (_.id)}
            <li>
              <a 
                on:click={navArtPieceClick(_.id)}
                href="{`/illustration/${_.id}/${cleanUrlSlug(_.attributes.title)}`}"
                class:active="{_.id === artPiece.id}" 
              >
                <img class:active={_.id === artPiece.id}
                  src={`${apiBaseUrl}${_.attributes.image.data.attributes.formats.thumbnail.url}`} 
                  alt={_.attributes.description} 
                />
              </a>
            </li>
          {/each}
        </ul>  
      {/each}
      {#if activePage !== artPiecesOrdered.length - 1}
        <div class="next" on:click={() => paginate(1)}>
          <Arrow direction="right" color="white" size="large" />
        </div>
      {/if}
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
    height: var(--nav-height);
    overflow: hidden;
    height: 4rem;
	}
  .wrap {
    width: var(--wrapper-width);
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
  }

  .last, .next {
    position: absolute;
    transition: transform 0.2s ease-in-out;
  }
  .last:hover, .next:hover {
    transform: scale(1.15);
  }
  .last {
    left: 2rem;
  }
  .next {
    right: 2rem;
  }
  ul {
		display: flex;
		list-style: none;
		padding: 0;
    align-items: center;
    position: absolute;
    transition: margin-left 0.4s ease-in-out, opacity 0.4s ease-in-out 0.2s;
	}
	ul img {
    transition: transform 0.2s ease-in-out;
		height: 4rem;
	}
  ul img:hover,
  ul img.active {
    transform: scale(1.15);
  }
  li {
    margin: 0 1rem;
  }
</style>