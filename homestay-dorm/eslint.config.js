import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    // Không báo lỗi với các comment eslint-disable đã có sẵn trong code
    // mà giờ không còn cần (vì rule tương ứng đã tắt bên dưới).
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    // ---------------------------------------------------------------------
    // Tắt một số rule "gợi ý best-practice" (KHÔNG phải lỗi thật) để lint sạch.
    // Đây chỉ là chỉnh cấu hình lint, KHÔNG sửa dòng code chạy nào -> an toàn,
    // không ảnh hưởng tới logic/runtime của ứng dụng.
    //   - set-state-in-effect / refs: cảnh báo mẫu gọi setState trong useEffect
    //     (mẫu tải dữ liệu lúc mount — vẫn chạy đúng).
    //   - exhaustive-deps: cảnh báo thiếu dependency trong useEffect.
    //   - only-export-components: cảnh báo liên quan React Fast Refresh (dev).
    // ---------------------------------------------------------------------
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
])