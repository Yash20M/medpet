const { withAndroidManifest, withAppBuildGradle } = require('expo/config-plugins');

/**
 * Local config plugin that reapplies two manual native-Android fixes on every
 * `expo prebuild` run. Prebuild fully regenerates AndroidManifest.xml and
 * app/build.gradle from scratch each time, which would otherwise silently
 * drop both of these:
 *
 *  1. usesCleartextTraffic="true" — lets dev/preview builds reach the LAN
 *     backend over plain HTTP (no TLS on a local dev server). Without this,
 *     cleartext requests to the LAN backend are blocked by Android.
 *
 *  2. externalNativeBuild.cmake.buildStagingDirectory — this project lives
 *     deep under OneDrive, and the default in-tree CMake/ninja object paths
 *     for codegen'd native components exceed Windows' 260-char MAX_PATH,
 *     breaking the build with cryptic path errors. Staging CMake output
 *     outside the project tree (a short path) avoids that.
 */

const CMAKE_STAGING_DIR = 'C:/rnb/medpet';

const withCleartextTraffic = (config) =>
  withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:usesCleartextTraffic'] = 'true';
    }
    return config;
  });

const withCmakeStagingDirectory = (config) =>
  withAppBuildGradle(config, (config) => {
    const marker = 'buildStagingDirectory';
    if (config.modResults.contents.includes(marker)) {
      return config; // already applied
    }

    const anchor = `androidResources {
        ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~'
    }`;

    if (!config.modResults.contents.includes(anchor)) {
      throw new Error(
        'withAndroidNativeFixes: could not find the expected androidResources block in ' +
          'app/build.gradle to anchor the CMake staging-directory fix. The Expo-generated ' +
          'build.gradle template may have changed — update plugins/withAndroidNativeFixes.js to match, ' +
          `then manually add externalNativeBuild { cmake { buildStagingDirectory = file("${CMAKE_STAGING_DIR}") } } ` +
          'inside the android { } block.'
      );
    }

    const injected = `${anchor}
    externalNativeBuild {
        cmake {
            // Project lives deep under OneDrive, and CMake/ninja object paths for the
            // codegen'd New Architecture components blow past Windows' 260-char MAX_PATH.
            // Stage the CMake/ninja build outside the project tree with a short path.
            buildStagingDirectory = file("${CMAKE_STAGING_DIR}")
        }
    }`;

    config.modResults.contents = config.modResults.contents.replace(anchor, injected);
    return config;
  });

module.exports = function withAndroidNativeFixes(config) {
  config = withCleartextTraffic(config);
  config = withCmakeStagingDirectory(config);
  return config;
};
