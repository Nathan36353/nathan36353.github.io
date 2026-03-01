#!/usr/bin/env python3
"""
Build combined + obfuscated bundles for final display.
1. Run combine.py on each entry point -> *-full.js
2. Obfuscate each *-full.js -> dist/xxx.min.js (requires Node: npx javascript-obfuscator)
3. HTML project pages load from dist/xxx.min.js

Usage: python build.py
Requires: Node.js + npx for obfuscation. If npx is missing, only combine step runs;
  then obfuscate *-full.js manually (e.g. with an online obfuscator) and put output in dist/.
"""
import os
import sys
import subprocess
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__)) or '.'
DIST = os.path.join(ROOT, 'dist')

ENTRIES = [
    ('main.js', 'demo.min.js'),
    ('main-scroll2.js', 'scroll2.min.js'),
    ('main-scroll4.js', 'scroll4.min.js'),
    ('main-scroll5.js', 'scroll5.min.js'),
    ('main-scroll6.js', 'scroll6.min.js'),
    ('main-scroll7.js', 'scroll7.min.js'),
    ('main-quest3.js', 'quest3.min.js'),
    ('main-quest4.js', 'quest4.min.js'),
]

def run_combine(entry):
    subprocess.run([sys.executable, os.path.join(ROOT, 'combine.py'), entry], cwd=ROOT, check=True)

def obfuscate(full_path, out_path):
    """Run javascript-obfuscator via npx. Returns True if successful."""
    try:
        subprocess.run([
            'npx', '--yes', 'javascript-obfuscator', full_path,
            '--output', out_path,
            '--compact', 'true',
            '--control-flow-flattening', 'false',
            '--string-array', 'true',
            '--string-array-threshold', '0.75',
        ], cwd=ROOT, check=True, capture_output=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def main():
    os.makedirs(DIST, exist_ok=True)
    has_npx = shutil.which('npx')

    for entry, min_name in ENTRIES:
        entry_path = os.path.join(ROOT, entry)
        if not os.path.isfile(entry_path):
            print('Skip (not found):', entry)
            continue
        base = entry[:-3]  # main -> main, main-scroll4 -> main-scroll4
        full_name = base + '-full.js'
        full_path = os.path.join(ROOT, full_name)
        out_path = os.path.join(DIST, min_name)

        print('Combine:', entry, '->', full_name)
        run_combine(entry)

        if has_npx:
            print('Obfuscate:', full_name, '->', 'dist/' + min_name)
            if obfuscate(full_path, out_path):
                print('  OK')
            else:
                print('  Failed; copying -full.js to dist/')
                shutil.copy(full_path, out_path)
        else:
            print('Obfuscate: npx not found. Copying', full_name, 'to dist/' + min_name)
            shutil.copy(full_path, out_path)

    if not has_npx:
        print('\nTo obfuscate: install Node.js, then run "python build.py" again.')
        print('Or obfuscate each *-full.js manually and save to dist/ as above.')

if __name__ == '__main__':
    main()
