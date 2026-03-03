import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import CategorySwitcher from "./components/CategorySwitcher.vue";
import "./custom.css";

const theme: Theme = {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.component("CategorySwitcher", CategorySwitcher);
  },
  // biome-ignore lint/style/useNamingConvention: VitePress theme API requires `Layout`.
  Layout: DefaultTheme.Layout,
};

export default theme;
