import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.schoolos.admin",
  appName: "SchoolOS Admin",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
