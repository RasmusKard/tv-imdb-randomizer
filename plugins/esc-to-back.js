const { withMainActivity } = require('@expo/config-plugins');

/**
 * TV key folds the React layer cannot do for itself, applied at the activity
 * before React sees the key.
 *
 * 1. Remotes and the emulator's back-arrow sometimes deliver ESC
 *    (KEYCODE_ESCAPE) instead of BACK — and ESC never reaches React Native's
 *    BackHandler, so screens with back handling feel trapped. Folded into BACK.
 * 2. A focused text editor swallows the D-pad on TV: up/down never leave the
 *    field, and ok degrades to a key-character-map fallback that inserts junk
 *    characters instead of firing the IME action — a rename field could never
 *    be committed with a remote. While an editor is on screen, the leaving
 *    keys (ok, up, down) become its editor action instead, which RN answers
 *    with onSubmitEditing and a blur — the field's commit. Left/right stay
 *    with the editor (cursor work).
 */
const KEY_FOLDS = `
  override fun dispatchKeyEvent(event: android.view.KeyEvent): Boolean {
    if (event.keyCode == android.view.KeyEvent.KEYCODE_ESCAPE) {
      val back = android.view.KeyEvent(
        event.downTime, event.eventTime, event.action,
        android.view.KeyEvent.KEYCODE_BACK, event.repeatCount, event.metaState,
        event.deviceId, event.scanCode, event.flags, event.source
      )
      return super.dispatchKeyEvent(back)
    }
    if (event.action == android.view.KeyEvent.ACTION_DOWN) {
      val editor = shownTextEditor(window.decorView)
      if (editor != null && (
          event.keyCode == android.view.KeyEvent.KEYCODE_DPAD_CENTER ||
            event.keyCode == android.view.KeyEvent.KEYCODE_DPAD_UP ||
            event.keyCode == android.view.KeyEvent.KEYCODE_DPAD_DOWN
          )
      ) {
        editor.onEditorAction(android.view.inputmethod.EditorInfo.IME_ACTION_DONE)
        return true
      }
    }
    return super.dispatchKeyEvent(event)
  }

  private fun shownTextEditor(view: android.view.View?): android.widget.EditText? {
    if (view == null) return null
    if (view.isShown && view is android.widget.EditText) return view
    if (view is android.view.ViewGroup) {
      for (i in 0 until view.childCount) {
        shownTextEditor(view.getChildAt(i))?.let { return it }
      }
    }
    return null
  }
`;

const withEscToBack = (config) =>
  withMainActivity(config, (cfg) => {
    const contents = cfg.modResults.contents;
    if (!contents.includes('KEYCODE_ESCAPE')) {
      const trimmed = contents.replace(/\s+$/, '');
      const lastBrace = trimmed.lastIndexOf('}');
      cfg.modResults.contents =
        trimmed.slice(0, lastBrace) + KEY_FOLDS + '}\n';
    }
    return cfg;
  });

module.exports = withEscToBack;
