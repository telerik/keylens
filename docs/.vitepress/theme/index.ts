import DefaultTheme from "vitepress/theme";
import "./custom.css";
import CopyCommand from "./CopyCommand.vue";
import Layout from "./Layout.vue";

export default {
  ...DefaultTheme,
  Layout,
  enhanceApp({ app, ...context }) {
    DefaultTheme.enhanceApp?.({ app, ...context });
    app.component("CopyCommand", CopyCommand);
  },
};
