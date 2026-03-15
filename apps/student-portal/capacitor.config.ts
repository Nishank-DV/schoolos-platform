import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.schoolos.student",
  appName: "SchoolOS Student",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
