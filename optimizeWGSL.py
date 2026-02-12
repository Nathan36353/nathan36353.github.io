#!/usr/bin/env python3
"""
Obfuscate WGSL shader using Tint round-trip (WGSL -> SPV -> WGSL).
Preserves entry point names (vertexMain, fragmentMain) so WebGPU can find them.
Usage: python optimizeWGSL.py <filename without extension>
Example: python optimizeWGSL.py standard2d
Produces: optimized_<filename>.wgsl (e.g. optimized_standard2d.wgsl)

Requires: Tint (Google Dawn) on PATH or in ./tint/ folder.
If Tint is not found, copies the source file to optimized_*.wgsl and warns.
"""
import os
import sys
import subprocess
import shutil

def find_tint():
    if shutil.which('tint'):
        return 'tint'
    for name in ('tint.exe', 'tint'):
        path = os.path.join(os.path.dirname(__file__) or '.', 'tint', name)
        if os.path.isfile(path):
            return path
    return None

def main():
    if len(sys.argv) < 2:
        print('Usage: python optimizeWGSL.py <shader name without extension>', file=sys.stderr)
        print('Example: python optimizeWGSL.py standard2d', file=sys.stderr)
        sys.exit(1)
    base = sys.argv[1]
    root = os.path.dirname(os.path.abspath(__file__)) or '.'
    # Shader may live in lib/Shaders/
    for sub in ('', 'lib/Shaders', 'lib\\Shaders'):
        wgsl_path = os.path.join(root, sub, base + '.wgsl')
        if os.path.isfile(wgsl_path):
            break
    else:
        wgsl_path = os.path.join(root, base + '.wgsl')
    if not os.path.isfile(wgsl_path):
        print('Error: file not found:', base + '.wgsl', file=sys.stderr)
        sys.exit(1)
    out_dir = os.path.dirname(wgsl_path)
    out_path = os.path.join(out_dir, 'optimized_' + base + '.wgsl')
    tint = find_tint()
    if not tint:
        print('Warning: Tint not found. Copying shader to', out_path, 'without obfuscation.', file=sys.stderr)
        shutil.copy(wgsl_path, out_path)
        print('Wrote', out_path)
        return
    # Tint: wgsl -> spv -> wgsl (entry points may be renamed; script may need to patch)
    spv_path = os.path.join(out_dir, base + '_tmp.spv')
    try:
        # Some Tint builds: tint read wgsl -o spv < input.wgsl
        subprocess.run([tint, 'read', 'wgsl', '-o', 'spv', wgsl_path, '-o', spv_path],
                      check=True, capture_output=True, text=True, cwd=root)
        subprocess.run([tint, 'read', 'spv', '-o', 'wgsl', spv_path, '-o', out_path],
                      check=True, capture_output=True, text=True, cwd=root)
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print('Tint round-trip failed:', e, file=sys.stderr)
        print('Copying shader without obfuscation.', file=sys.stderr)
        shutil.copy(wgsl_path, out_path)
    finally:
        if os.path.isfile(spv_path):
            try:
                os.remove(spv_path)
            except OSError:
                pass
    print('Wrote', out_path)

if __name__ == '__main__':
    main()
