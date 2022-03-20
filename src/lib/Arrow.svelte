
<script lang="ts">
  export let direction: "top" | "right" | "bottom" | "left";
  export let color: "blue" | "white"; 
  export let size: "small" | "large" 
</script>

<i 
  class={`arrow ${direction} ${color} ${size}`} 
/>

<style>
  .arrow {
    border: var(--off-bk);
    display: inline-block;
    cursor: pointer;
  }
  .small {
    border-width: 0 0.25rem 0.25rem 0;
    padding: 0.25rem;
  }
  .large {
    border-width: 0 0.5rem 0.5rem 0;
    padding-left: 2rem;
    height: 2rem;
    border-radius: 0.33rem;
  }
  .right {
    transform: rotate(-45deg);
    -webkit-transform: rotate(-45deg);
  }
  .left {
    transform: rotate(135deg);
    -webkit-transform: rotate(135deg);
  }
  .up {
    transform: rotate(-135deg);
    -webkit-transform: rotate(-135deg);
  }
  .down {
    transform: rotate(45deg);
    -webkit-transform: rotate(45deg);
  }
  .blue {
    border-style: solid;
    border-color: var(--bg-lt);
  }
  .blue:hover {
    border-style: solid;
    border-color: var(--b-lt);
  }
  .white {
    border-style: solid;
    border-color: var(--w-lt);

  }
  .white:hover {
    border-style: solid;
    border-color:var(--w-xl);
  }
</style>