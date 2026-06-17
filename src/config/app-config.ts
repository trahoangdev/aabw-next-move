import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "AABW Next Move",
  version: packageJson.version,
  copyright: `© ${currentYear}, AABW Next Move.`,
  meta: {
    title: "AABW Next Move - Builder Experience Copilot",
    description:
      "AABW Next Move helps builders decide where to go, who to meet, and what to do next during Agentic AI Build Week.",
  },
};
