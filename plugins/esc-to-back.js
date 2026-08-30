const { withMainActivity } = require('@expo/config-plugins');

/**
 * TV remotes and the emulator's back-arrow sometimes deliver ESC
 * (KEYCODE_ESCAPE) instead of BACK — and ESC never reaches React Native's
 * BackHandler, so screens with back handling feel trapped. This plugin folds
 * ESC into BACK at the activity, before React sees the key.
 */
const ESC_DISPATCH = `
  override fun dispatchKeyEvent(event: android.view.KeyEvent): Boolean {
    if (event.keyCode == android.view.KeyEvent.KEYCODE_ESCAPE) {
      val back = android.view.KeyEvent(
        event.downTime, event.eventTime, event.action,
        android.view.KeyEvent.KEYCODE_BACK, event.repeatCount, event.metaState,
        event.deviceId, event.scanCode, event.flags, event.source
      )
      return super.dispatchKeyEvent(back)
    }
    return super.dispatchKeyEvent(event)
  }
`;

const withEscToBack = (config) =>
  withMainActivity(config, (cfg) => {
    const contents = cfg.modResults.contents;
    if (!contents.includes('KEYCODE_ESCAPE')) {
      const trimmed = contents.replace(/\s+$/, '');
      const lastBrace = trimmed.lastIndexOf('}');
      cfg.modResults.contents =
        trimmed.slice(0, lastBrace) + ESC_DISPATCH + '}\n';
    }
    return cfg;
  });

module.exports = withEscToBack;
