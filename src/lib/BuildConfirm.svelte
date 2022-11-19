<script lang="ts">
  export let title: string;
  export let data: Record<string, any>;
</script>

<section>
  <h3>{title} Built Successfully</h3>
  <pre> 
    {JSON.stringify(data, undefined, 2)}
  </pre>
</section>

<style>
  section {
    margin-top: 1rem;
  }

</style>