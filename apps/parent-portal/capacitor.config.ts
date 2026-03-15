import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.schoolos.parent",
  appName: "SchoolOS Parent",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
