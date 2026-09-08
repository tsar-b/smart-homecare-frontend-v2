const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');

// Exercise production TypeScript without an extra runtime dependency. Each
// subject gets an isolated module cache; native modules can be explicit mocks.
function loadTypeScript(relativePath, mocks = {}) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const localRequire = createRequire(filename);
    const module = { exports: {} };
    cache.set(filename, module);
    const requireSubject = specifier => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier.startsWith('.')) {
        const base = path.resolve(path.dirname(filename), specifier);
        const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
        const target = candidates.find(candidate => /\.tsx?$/.test(candidate) && fs.existsSync(candidate));
        if (target) return load(target);
      }
      return localRequire(specifier);
    };
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });
    const evaluate = vm.runInThisContext(
      `(function(require, module, exports, __filename, __dirname) {\n${compiled.outputText}\n})`,
      { filename },
    );
    evaluate(requireSubject, module, module.exports, filename, path.dirname(filename));
    return module.exports;
  }
  return load(path.resolve(root, relativePath));
}

module.exports = { loadTypeScript };
