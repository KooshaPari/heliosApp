<template>
  <div class="category-switcher">
    <label for="docs-category">Section</label>
    <select id="docs-category" v-model="selected" @change="navigateToCategory">
      <option value="/wiki/">Wiki</option>
      <option value="/development/">Development Guide</option>
      <option value="/index/">Document Index</option>
      <option value="/api/">API</option>
      <option value="/roadmap/">Roadmap</option>
    </select>
  </div>
</template>

<script lang="ts">
import { useRoute, useRouter } from "vitepress";
import { defineComponent, ref, watchEffect } from "vue";

export default defineComponent({
  name: "CategorySwitcher",
  setup() {
    const route = useRoute();
    const router = useRouter();
    const selected = ref("/wiki/");

    const navigateToCategory = () => {
      router.go(selected.value);
    };

    watchEffect(() => {
      const p = route.path;
      if (p.startsWith("/development/")) {
        selected.value = "/development/";
      } else if (p.startsWith("/index/")) {
        selected.value = "/index/";
      } else if (p.startsWith("/api/")) {
        selected.value = "/api/";
      } else if (p.startsWith("/roadmap/")) {
        selected.value = "/roadmap/";
      } else {
        selected.value = "/wiki/";
      }
    });

    return {
      selected,
      navigateToCategory,
    };
  },
});
</script>
