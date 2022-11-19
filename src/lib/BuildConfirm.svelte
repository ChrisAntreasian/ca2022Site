<script lang="ts">
  export let title: string;
  export let data: Record<string, any>;
</script>

<section>
  <h3>{title} Built Successfully</h3>
  <pre> 
    <code>
    {JSON.stringify(data, undefined, 2)}
    </code>
  </pre>
</section>

<style>
  section {
    flex-direction: column;
    margin-top: 4rem;
    padding: 0 1rem 3rem;
    box-sizing: border-box;
  }
  h3 {
    text-align: center;
  }

</style>