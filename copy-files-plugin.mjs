import { copyFileSync, mkdirSync, existsSync } from 'fs';

export const copyFilesPlugin = (files = [
  { from: './manifest.json', to: './dist/manifest.json' }
]) => ({
  name: 'copy-files',
  setup(build) {
    build.onEnd(() => {
      if (!existsSync('./dist')) {
        mkdirSync('./dist');
      }

      for (const file of files) {
        copyFileSync(file.from, file.to);
      }
    });
  },
}); 
