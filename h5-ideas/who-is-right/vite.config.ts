import { defineConfig, type Plugin } from 'vite';
import { library } from './src/content/library.ts';
import { checkLibrary, formatIssues } from './src/content/gate.ts';

function contentGate(): Plugin {
  return {
    name: 'content-gate',
    buildStart() {
      const issues = checkLibrary(library);
      if (issues.length > 0) {
        throw new Error(`内容发布门槛未通过（${issues.length} 项）：\n${formatIssues(issues)}`);
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [contentGate()],
  server: { strictPort: false },
});
