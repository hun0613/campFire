// 페이지 세 개를 빌드한다: 게임(index.html) + 관리자 페이지(admin.html) + 불멍 디자인 시스템(lab.html)
import { resolve } from 'node:path';

export default {
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
        lab: resolve(import.meta.dirname, 'lab.html'), // 불멍 디자인 시스템 (실험실)
      },
    },
  },
};
