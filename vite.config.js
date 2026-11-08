// 페이지 두 개를 빌드한다: 게임(index.html) + 관리자 페이지(admin.html)
import { resolve } from 'node:path';

export default {
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
      },
    },
  },
};
