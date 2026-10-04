const app = document.getElementById('app')!;
const params = new URLSearchParams(location.search);

function fatal(msg: string) {
  const boot = document.getElementById('boot');
  const el = boot ?? document.body.appendChild(document.createElement('div'));
  el.id = 'boot';
  el.style.cssText += ';white-space:pre-wrap;text-align:center;padding:24px;line-height:1.8;color:#ff5a7a';
  el.textContent = msg;
}

function hasWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

if (params.get('test') === 'chars') {
  import('./dev/charTest').then((m) => m.charTest(app));
} else if (!hasWebGL2()) {
  fatal('GLOOMOS // FATAL\n\nThis voyage requires WebGL 2.\nPlease use a recent desktop browser with hardware acceleration enabled.');
} else {
  import('./game/Game')
    .then(({ Game }) => {
      const game = new Game(app);
      (window as any).__GM = game;
      game.debug = params.has('debug');
      if (game.debug) import('./dev/Debug').then((m) => m.installDebug(game));
      if (game.debug && params.has('auto')) game.autoplay = +(params.get('auto') || 0.2);
      game.start();
      const dbg = params.get('chapter');
      if (dbg && game.debug) {
        void game.newGame((params.get('diff') as any) ?? 'normal', dbg);
        // e.g. &set=final=truth,boss_gridlock_dead=1
        for (const kv of (params.get('set') ?? '').split(',').filter(Boolean)) {
          const [k, v] = kv.split('=');
          game.state.flags[k] = v === undefined || v === '1' ? true : v;
        }
      }
    })
    .catch((e) => {
      console.error(e);
      fatal('GLOOMOS // FATAL\n\n' + String(e?.message ?? e));
    });
}
