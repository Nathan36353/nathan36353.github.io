#!/usr/bin/env python3
"""
Combine a main JavaScript module and its dependencies into one file.
Usage: python combine.py ./main.js
Produces: main-full.js (all imports inlined, exports removed).
"""
import re
import sys
import os
from pathlib import Path

def resolve_path(import_path, from_file, root_dir):
    """Resolve import path to filesystem path. Assumes / is repo root."""
    path = import_path.strip('"\'')
    if path.startswith('/'):
        path = path[1:]
    path = path.lstrip('./')
    base = os.path.dirname(from_file)
    if not path.startswith('lib'):
        path = os.path.normpath(os.path.join(base, path))
    return os.path.normpath(os.path.join(root_dir, path)) if root_dir else path

def collect_imports(content):
    """Return list of (module_spec, path) from import statements."""
    # import X from '/path' or import X from "./path"
    pattern = re.compile(r'import\s+.+?\s+from\s+[\'"]([^\'"]+)[\'"]')
    return pattern.findall(content)

def strip_imports_and_export(content, use_optimized_wgsl=True):
    """Remove import lines and 'export default ' prefix. Optionally rewrite .wgsl to optimized_*.wgsl."""
    lines = []
    for line in content.splitlines():
        if re.match(r'\s*import\s+', line):
            continue
        line = re.sub(r'export\s+default\s+', '', line)
        if use_optimized_wgsl:
            line = re.sub(r"(['\"])([^'\"]*?)([^/\\]+)\.wgsl\1", r'\1\2optimized_\3.wgsl\1', line)
        lines.append(line)
    return '\n'.join(lines)

def find_all_modules(entry_path, root_dir):
    """Collect all module file paths reachable from entry."""
    entry_path = os.path.normpath(os.path.join(root_dir, entry_path))
    seen = set()
    stack = [entry_path]
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.add(current)
        try:
            with open(current, 'r', encoding='utf-8') as f:
                content = f.read()
        except FileNotFoundError:
            print('Warning: cannot open', current, file=sys.stderr)
            continue
        for imp in collect_imports(content):
            resolved = resolve_path(imp, current, root_dir)
            if resolved not in seen:
                stack.append(resolved)
    return list(seen)

def topological_order(entry_path, root_dir):
    """Return files in dependency order (dependency before dependant)."""
    entry_path = os.path.normpath(os.path.join(root_dir, entry_path))
    nodes = find_all_modules(entry_path, root_dir)
    # Build graph: file -> list of imported files (deps)
    graph = {}
    for filepath in nodes:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except FileNotFoundError:
            continue
        deps = [resolve_path(imp, filepath, root_dir) for imp in collect_imports(content)]
        graph[filepath] = [d for d in deps if d in nodes]
    # Topological sort (deps first)
    order = []
    visited = set()
    def visit(n):
        if n in visited:
            return
        visited.add(n)
        for d in graph.get(n, []):
            visit(d)
        order.append(n)
    for n in nodes:
        visit(n)
    return order

def main():
    if len(sys.argv) < 2:
        print('Usage: python combine.py ./main.js', file=sys.stderr)
        sys.exit(1)
    main_script = sys.argv[1].replace('\\', '/')
    root_dir = os.path.dirname(os.path.abspath(main_script)) or '.'
    base = os.path.basename(main_script)
    if base.endswith('.js'):
        base = base[:-3]
    out_name = base + '-full.js'
    out_path = os.path.join(root_dir, out_name)

    entry_norm = os.path.normpath(os.path.join(root_dir, main_script))
    if not os.path.isfile(entry_norm):
        entry_norm = main_script
    order = topological_order(main_script, root_dir)

    parts = []
    for filepath in order:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        parts.append(strip_imports_and_export(content, use_optimized_wgsl=True))

    combined = '\n\n'.join(parts)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(combined)
    print('Wrote', out_path)

if __name__ == '__main__':
    main()
