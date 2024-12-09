<script lang="ts">
  import { page } from "$app/stores";
  import { captureClickThis } from "$lib/analytics";
  import githubIcon from "./github-mark.svg";

  interface Props {
    footerHeight: number;
  }

  let { footerHeight = $bindable() }: Props = $props();

  const navClick = captureClickThis("footer nav");
</script>

<footer bind:clientHeight={footerHeight}>
  <div class="footer-wrap">
    <nav>
      <ul>
        <li
          onclick={() => navClick("Home")}
          onkeypress={() => navClick("Home")}
          class:active={$page.url.pathname === "/"}
        >
          <a href="/">Home</a>
        </li>
        <li
          onclick={() => navClick("The Quintuplapus")}
          onkeypress={() => navClick("The Quintuplapus")}
          class:active={$page.url.pathname === "/the-quintuplapus"}
        >
          <a href="/the-quintuplapus">The Quintuplapus</a>
        </li>
        <li
          onclick={() => navClick("Poems")}
          onkeypress={() => navClick("Poems")}
          class:active={$page.url.pathname === "/poems"}
        >
          <a href="/poems">Poems</a>
        </li>
        <li
          onclick={() => navClick("Web Experience")}
          onkeypress={() => navClick("Web Experience")}
          class:active={$page.url.pathname === "/web-experience"}
        >
          <a href="/poems">Web Experience</a>
        </li>
      </ul>
    </nav>
    <div class="details">
      <a href="https://github.com/ChrisAntreasian/ca2022Site" target="_blank">
        <div class="github-icon" style={`--github-icon: ${githubIcon}`}></div>
        <img src={githubIcon} alt={"check the source out on github"} />
        <h4>Built with SvelteKit</h4>
      </a>
      <span>&copy; Christopher Antreasian</span>
    </div>
  </div>
</footer>

<style>
  footer {
    width: 100%;
    bottom: 0;
    display: flex;
    justify-content: center;
    height: var(--footer-height);
    background-image: linear-gradient(var(--o-md) 75%, var(--o-dk));
    border-top: 0.5rem solid var(--b-dk);
  }
  .footer-wrap {
    max-width: var(--wrapper-width);
    display: flex;
    justify-content: space-between;
    width: 100%;
  }
  ul {
    padding: 0;
    margin: 0;
    height: var(--footer-height);
    display: flex;
    justify-content: center;
    align-items: center;
    list-style: none;
    background: var(--background);
    background-size: contain;
  }
  li {
    display: flex;
    height: 100%;
    align-items: center;
    position: relative;
    padding: 0 1em;
  }
  a {
    color: var(--off-bk);
    font-size: 1rem;
    letter-spacing: 0.05em;
    text-decoration: none;
    transition: color 0.2s linear;
    transition: transform 0.1s linear;
    color: var(--b-dk);
    font-family: "josefin-bold";
  }
  nav a:hover {
    transform: scale(1.15);
    color: var(--b-md);
  }
  .details {
    display: flex;
    flex-direction: column;
    font-size: 0.75rem;
    justify-content: center;
    align-items: flex-end;
    padding: 1rem 1rem 1rem 0;
  }
  .details h4,
  .details span {
    font-size: 1rem;
    font-family: "josefin-italic";
  }
  h4 {
    letter-spacing: 0rem;
    line-height: 1rem;
    color: var(--b-dk);
  }
  .details a {
    display: flex;
    align-items: flex-end;
    padding: 0.5rem 0;
    transition: color 0.2s linear;
    transition: transform 0.1s linear;
  }
  .details a:hover {
    transform: scale(1.15);
    color: var(--b-md);
  }
  .details a img,
  .details a h4 {
    color: var(--b-dk);
  }
  .details img {
    height: 1.25rem;
    margin-right: 0.5rem;
    filter: invert(13%) sepia(33%) saturate(1000%) hue-rotate(180deg)
      brightness(100%) contrast(100%);
  }
  .details a:hover h4 {
    color: var(--b-md);
  }
  .details a:hover img {
    filter: invert(25%) sepia(57%) saturate(500%) hue-rotate(170deg)
      brightness(90%) contrast(100%);
  }

  @media (max-width: 767.98px) {
    div {
      flex-direction: column;
    }
    footer {
      height: auto;
      padding: 1rem 0;
    }
    ul {
      flex-direction: column;
      align-items: flex-start;
    }
    h4 {
      line-height: 1.5rem;
    }
    .details a {
      align-items: center;
    }
  }
</style>
