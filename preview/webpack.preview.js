// Dev-only: bundles just the settings UI so it can be screenshotted in a normal browser.
import makeConfig from '../webpack.config.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export default (env, argv) => {
  const [base] = makeConfig(env, argv);
  return {
    ...base,
    entry: { preview: resolve(here, 'entry.js') },
    output: { path: resolve(here, 'dist'), filename: '[name].js' },
    plugins: base.plugins.filter((p) => p.constructor.name !== 'CopyPlugin')
  };
};
