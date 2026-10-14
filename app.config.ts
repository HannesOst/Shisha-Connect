/// <reference types="node" />
import fs from 'node:fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Extends app.json with values that differ per developer / build machine.
export default ({ config }: ConfigContext): ExpoConfig => {
  // FCM (Android push) needs google-services.json. On EAS it is provided as a file
  // environment variable GOOGLE_SERVICES_JSON, locally it can live in the project root.
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ??
    (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);

  return {
    ...(config as ExpoConfig),
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    extra: {
      ...config.extra,
      eas: {
        ...config.extra?.eas,
        projectId: process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId || undefined,
      },
    },
  };
};
