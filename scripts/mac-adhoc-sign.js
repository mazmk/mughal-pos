/**
 * electron-builder afterPack hook: ad-hoc signs the macOS app.
 *
 * We ship without an Apple Developer ID (`mac.identity: null`), so
 * electron-builder skips signing. But it still rewrites Electron's Info.plist
 * and renames the bundle, which breaks the signature Electron shipped with.
 * Apple Silicon refuses to run a broken signature, and a downloaded copy (with
 * the quarantine flag) is reported as "damaged — move it to the Trash".
 * A locally built copy has no quarantine flag, which is why it opens fine.
 *
 * An ad-hoc signature ("-") is free and makes the bundle consistent again.
 * Gatekeeper then shows the normal "unidentified developer" prompt instead,
 * which the user can get past via System Settings → Privacy & Security →
 * Open Anyway. Removing that prompt too needs a Developer ID + notarization.
 */
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });
};
