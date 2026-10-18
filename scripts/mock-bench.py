#!/usr/bin/env python3
"""Owned loopback-only DSH fixture. No real profile, copied credentials or real model."""
from pathlib import Path
import json, os, re, signal, socket, subprocess, sys, time

BENCH = Path(__file__).resolve().parent
WORKSPACE = BENCH.parent
UPSTREAM = WORKSPACE / 'ds-bot-upstream/ds-bot'
HARNESS = UPSTREAM / 'dev/harness/node_modules'
HOME_DIR = BENCH / '.dsh-test-mobile'
WEB_PORT, MOCK_PORT = 3298, 8899

def prepare():
    HOME_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(HOME_DIR, 0o700)
    profile = HOME_DIR / 'profiles/web'
    profile.mkdir(parents=True, exist_ok=True)
    packages = {'ds-bot': UPSTREAM, 'dsh-mobile-host-adapter-local': WORKSPACE / 'mobile-host-adapter',
                'dsh-mobile-layout-local': WORKSPACE / 'mobile-web-prototype/plugin'}
    manifest = {'name': 'dsh-profile-web', 'private': True,
      'dependencies': {name: 'link:' + str(path) for name, path in packages.items()},
      'dsh': {'profile': {'bundles': ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'ds-bot', 'dsh-mobile-layout-local']}}}
    (profile / 'package.json').write_text(json.dumps(manifest, indent=2) + '\n')
    modules = profile / 'node_modules'
    modules.mkdir(exist_ok=True)
    for name, target in {'@deepseek-ai': HARNESS / '@deepseek-ai', **packages}.items():
        link = modules / name
        if link.is_symlink():
            if link.resolve() != target.resolve():
                raise RuntimeError('Fixture module link target mismatch')
        elif link.exists():
            raise RuntimeError('Refusing to replace existing fixture module directory')
        else:
            link.symlink_to(target, target_is_directory=True)
    (HOME_DIR / 'bench.patch.yml').write_text('''- id: bot
  config:
    checkRatio: 0.45
- id: llm-deepseek
  config:
    models:
      - { id: deepseek-flash, contextWindow: 100000, maxTokens: 8000, inputModalities: [text, image] }
      - { id: deepseek-v4-pro, contextWindow: 100000, maxTokens: 8000 }
- insert:
    - id: mobile-host-adapter
      name: dsh-mobile-host-adapter-local
''')
    return profile

def main():
    prepare()
    for port in (WEB_PORT, MOCK_PORT):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', port))
    env = {k:v for k,v in os.environ.items() if not k.startswith('DSH_SECRET_')}
    env.update(DSH_HOME=str(HOME_DIR), DEEPSEEK_BASE_URL=f'http://127.0.0.1:{MOCK_PORT}/v1', DEEPSEEK_API_KEY='mock-key')
    children, logs = [], []
    def stopped(*_): raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, stopped)
    signal.signal(signal.SIGINT, stopped)
    try:
        for name, args, cwd, extra in (
            ('mock', ['node', str(UPSTREAM / 'dev/mock-llm.mjs')], BENCH,
             {'MOCK_PORT': str(MOCK_PORT), 'MOCK_DELAY_MS': '700', 'MOCK_LOG': str(HOME_DIR / 'mock.jsonl')}),
            ('web', ['node', str(HARNESS / '@deepseek-ai/dsh/lib/bin.js'), '--profile', 'web', '--patch', str(HOME_DIR / 'bench.patch.yml'),
             '--no-open', '--port', str(WEB_PORT)], BENCH, {}),
        ):
            logpath = HOME_DIR / (name + '.log')
            fd = os.open(logpath, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            log = os.fdopen(fd, 'w'); logs.append(log)
            child = subprocess.Popen(args, cwd=cwd, env=dict(env, **extra), stdin=subprocess.DEVNULL,
                                     stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            children.append((name, child))
            print(f'{name}: owned group {child.pid}', flush=True)
        for _ in range(600):
            if any(child.poll() is not None for _, child in children):
                # Startup logs contain credentials. Report sanitized lines through diagnostics.py.
                raise RuntimeError('Owned fixture process exited; use diagnostics.py for sanitized errors')
            text = (HOME_DIR / 'web.log').read_text()
            if 'dsh web: http' in text:
                break
            time.sleep(0.1)
        else: raise RuntimeError('Fixture startup timed out')
        (HOME_DIR / 'running.json').write_text(json.dumps({'runner': os.getpid(), 'webPort': WEB_PORT, 'mockPort': MOCK_PORT,
                                                         'processes': {name: child.pid for name, child in children}}))
        print(f'READY http://127.0.0.1:{WEB_PORT}/', flush=True)
        print('Use scripts/browser-login.mjs for private test login; never print web.log or token.', flush=True)
        while all(child.poll() is None for _, child in children): time.sleep(0.5)
        raise RuntimeError('Fixture service stopped unexpectedly')
    except KeyboardInterrupt:
        pass
    finally:
        for name, child in reversed(children):
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGTERM)
                try: child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL); child.wait(timeout=5)
            print(f'{name}: stopped owned group {child.pid}', flush=True)
        for log in logs: log.close()
        # Keep fixture artifacts for review; no delete/reset operation is performed.

if __name__ == '__main__': main()
