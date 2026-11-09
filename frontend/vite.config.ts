import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `npm run dev:mobile`(mode=mobile): 같은 Wi-Fi의 휴대폰에서 접속할 수 있도록
// 네트워크에 열고 HTTPS(자체 서명 인증서)로 띄웁니다. 휴대폰 브라우저는 HTTPS에서만 마이크를 허용합니다.
export default defineConfig(({ mode }) => {
  const mobile = mode === "mobile";
  return {
    plugins: [react(), mobile && basicSsl()],
    server: {
      port: 5173,
      host: mobile ? true : undefined,
      proxy: { "/api": "http://localhost:8787" },
    },
  };
});
