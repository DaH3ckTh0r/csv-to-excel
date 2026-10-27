// Cucumber (BDD) configuration. Step definitions are TypeScript; the npm script
// runs cucumber under `node --import tsx` so they load without a build step.
export default {
  paths: ["features/**/*.feature"],
  import: ["features/step_definitions/**/*.ts"],
  format: ["progress-bar", "summary"],
};
