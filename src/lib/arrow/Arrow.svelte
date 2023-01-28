
<script lang="ts">  
  export let direction: "top" | "right" | "bottom" | "left";
  export let color: "blue" | "white"; 
  export let size: "small" | "medium" | "large" 
</script>

<div class={`arrow ${direction} ${color} ${size}`} />

<style>
  .arrow {
    display: inline-block;
    cursor: pointer;
    -webkit-mask: url("arrow.svg") no-repeat center;
    mask: url("arrow.svg") no-repeat center;
    transition: transform 0.2s ease-in-out; 
  }
  .small {
    height: 1.5rem;
    width: 1.5rem;
  }
  .medium {
    height: 3rem;
    width: 3rem;
  }
  .large {
    height: 4rem;
    width: 4rem;
  }
  .right {
    transform: rotate(-90deg);
    -webkit-transform: rotate(-90deg);
  }
  .left {
    transform: rotate(90deg);
    -webkit-transform: rotate(90deg);
  }
  .top {
    transform: rotate(180deg);
    -webkit-transform: rotate(180deg);
  }
  .bottom {
    transform:rotate(0deg);
    -webkit-transform: rotate(0deg);
  }
  .blue {
    background-color: var(--bg-lt);
  }
  .blue:hover {
    background-color: var(--b-lt);
  }
  .white {
    background-color: var(--w-lt);
  }
  .white:hover {
    background-color:var(--w-xl);
  }
</style>