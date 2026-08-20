import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, type Plugin } from 'vite';
import { createGameAssetManifest } from './game-assets-manifest.mjs';
import { handleDemoCommentsRequest } from './demo-comments-store.mjs';

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const bundledDemoPath = resolve(projectDirectory, '../r60_sthlm.dem');
const demosDirectory = resolve(projectDirectory, '../demos');
const demoAnalysisDirectory = resolve(projectDirectory, '../demo-analysis');
const commentsFile = resolve(process.env.HLTV_COMMENTS_FILE || resolve(projectDirectory, '../demo-comments.json'));
const gameAssetsDirectory = resolve(projectDirectory, 'game-assets');
const protocol46RuntimePath = resolve(projectDirectory, 'src/vendor/xash-protocol46.js');
const upstreamRuntimePath = resolve(
  projectDirectory,
  'node_modules/xash3d-fwgs/dist/generated/xash.js',
);
const demoAssetPaths = new Set<string>(
  JSON.parse(readFileSync(resolve(projectDirectory, 'demo-assets.json'), 'utf8')),
);

const parseRange = (range: string | undefined, size: number) => {
  const match = range?.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) return { start: 0, end: size - 1, partial: false };
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  const end = Math.min(requestedEnd, size - 1);
  return { start, end, partial: true };
};

const localDemoPlugin = (): Plugin => ({
  name: 'hltv-local-demo',
  configureServer(server) {
    server.middlewares.use('/demos/r60_sthlm.dem', (request, response) => {
      const { size } = statSync(bundledDemoPath);
      const { start, end, partial } = parseRange(request.headers.range, size);
      response.statusCode = partial ? 206 : 200;
      response.setHeader('Content-Type', 'application/octet-stream');
      response.setHeader('Accept-Ranges', 'bytes');
      response.setHeader('Content-Length', end - start + 1);
      if (partial) response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      createReadStream(bundledDemoPath, { start, end }).pipe(response);
    });
  },
});

const localArchivePlugin = (): Plugin => ({
  name: 'hltv-local-archive',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
      const route = requestPath.startsWith('/demo-files/')
        ? {
            root: demosDirectory,
            relativePath: requestPath.slice('/demo-files/'.length),
            extension: '.dem',
            ranges: true,
          }
        : requestPath.startsWith('/demo-analysis/')
          ? {
              root: demoAnalysisDirectory,
              relativePath: requestPath.slice('/demo-analysis/'.length),
              extension: '.dem.json',
              ranges: false,
            }
          : undefined;
      if (!route) {
        next();
        return;
      }

      const candidate = resolve(route.root, route.relativePath);
      const safeCandidate = candidate.startsWith(`${route.root}${sep}`) ? candidate : '';
      if (!safeCandidate
        || !safeCandidate.toLowerCase().endsWith(route.extension)
        || !existsSync(safeCandidate)
        || statSync(safeCandidate).isDirectory()) {
        response.statusCode = 404;
        response.end('Archive file not found.');
        return;
      }

      const { size } = statSync(safeCandidate);
      const { start, end, partial } = route.ranges
        ? parseRange(request.headers.range, size)
        : { start: 0, end: size - 1, partial: false };
      response.statusCode = partial ? 206 : 200;
      response.setHeader(
        'Content-Type',
        route.extension === '.dem.json' ? 'application/json; charset=utf-8' : 'application/octet-stream',
      );
      if (route.ranges) response.setHeader('Accept-Ranges', 'bytes');
      response.setHeader('Content-Length', end - start + 1);
      if (partial) response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      createReadStream(safeCandidate, { start, end }).pipe(response);
    });
  },
});

const localCommentsPlugin = (): Plugin => ({
  name: 'hltv-local-comments',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (!handleDemoCommentsRequest(request, response, { commentsFile, demosDirectory })) next();
    });
  },
});

const localGameAssetsPlugin = (): Plugin => ({
  name: 'hltv-local-game-assets',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);

      if (requestPath === '/game-assets-manifest.json') {
        const url = new URL(request.url || '/', 'http://localhost');
        const mapText = url.searchParams.get('map')?.toLowerCase() || 'de_train';
        const checksumText = url.searchParams.get('checksum')?.toLowerCase();
        const requestedMap = /^[a-z0-9_]+$/.test(mapText) ? mapText : 'de_train';
        const requestedChecksum = checksumText && /^[0-9a-f]{8}$/.test(checksumText)
          ? Number.parseInt(checksumText, 16) >>> 0
          : undefined;
        const body = JSON.stringify(createGameAssetManifest({
          gameAssetsDirectory,
          demoAssetPaths,
          requestedMap,
          requestedChecksum,
        }));
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Content-Length', Buffer.byteLength(body));
        response.end(body);
        return;
      }

      if (!requestPath.startsWith('/game-assets/')) {
        next();
        return;
      }

      const relativePath = requestPath.slice('/game-assets/'.length);
      const candidate = resolve(gameAssetsDirectory, relativePath);
      const safeCandidate = candidate.startsWith(`${gameAssetsDirectory}${sep}`) ? candidate : '';
      if (!safeCandidate || !existsSync(safeCandidate) || statSync(safeCandidate).isDirectory()) {
        response.statusCode = 404;
        response.end('Spelresursen saknas.');
        return;
      }

      const { size } = statSync(safeCandidate);
      if (size === 0) {
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/octet-stream');
        response.setHeader('Content-Length', 0);
        response.end();
        return;
      }
      const { start, end, partial } = parseRange(request.headers.range, size);
      response.statusCode = partial ? 206 : 200;
      response.setHeader('Content-Type', 'application/octet-stream');
      response.setHeader('Accept-Ranges', 'bytes');
      response.setHeader('Content-Length', end - start + 1);
      if (partial) response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      createReadStream(safeCandidate, { start, end }).pipe(response);
    });
  },
});

const protocol46AsmCompatibilityPlugin = (): Plugin => ({
  name: 'hltv-protocol46-asm-compatibility',
  enforce: 'pre',
  transform(code, id) {
    if (!id.startsWith(protocol46RuntimePath)) return;

    // The source engine's Waf build invokes main immediately, while the npm
    // wrapper deliberately mounts assets first and then calls em.start().
    // Restore that small wrapper contract around the exact generated glue.
    const legacyAutoRun = /var wasmExports;wasmExports=await \(createWasm\(\)\);run\(\);if\(runtimeInitialized\)\{moduleRtn=Module\}else\{moduleRtn=new Promise\(\(resolve,reject\)=>\{readyPromiseResolve=resolve;readyPromiseReject=reject\}\)\}/;
    const asyncAutoRun = /var wasmExports;wasmExports=await createWasm\(\);await run\(\);/;
    const autoRun = legacyAutoRun.test(code) ? legacyAutoRun : asyncAutoRun;
    if (!autoRun.test(code)) {
      throw new Error('Kunde inte hitta Xash3D:s autostart i protocol-46-runtime.');
    }
    const deferredRuntime = code.replace(
      autoRun,
      'var wasmExports;wasmExports=await createWasm();return{Module,FS,SOCKFS,DNS,HEAPU32,HEAP32,HEAP16,HEAP8,HEAPU8,getValue,addFunction,removeFunction,setValue,writeArrayToMemory,intArrayFromString,writeSockaddr,readSockaddr,AsciiToString,_malloc,addRunDependency,removeRunDependency,start:()=>{void run()}}',
    );

    // Engine side modules are byte-identical to the pinned upstream package and
    // call its EM_ASM data addresses. Compute the relocation from the generated
    // runtimes so rebuilding the main module never requires another magic offset.
    const firstAsmAddress = (source: string, label: string): number => {
      const match = source.match(/var ASM_CONSTS\s*=\s*\{\s*(\d+)\s*:/);
      if (!match) throw new Error(`Kunde inte läsa ASM_CONSTS från ${label}.`);
      return Number(match[1]);
    };
    const relocation = firstAsmAddress(deferredRuntime, 'protocol-46-runtime')
      - firstAsmAddress(readFileSync(upstreamRuntimePath, 'utf8'), 'upstream-runtime');
    const marker = ';var _Cmd_ExecuteString';
    if (!deferredRuntime.includes(marker)) {
      throw new Error('Kunde inte hitta ASM_CONSTS-markören i protocol-46-runtime.');
    }
    const withAliases = deferredRuntime.replace(
      marker,
      `;for(const [address,callback] of Object.entries(ASM_CONSTS)){ASM_CONSTS[Number(address)-${relocation}]??=callback}` + marker,
    );
    const callMarker = 'return ASM_CONSTS[emAsmAddr](...args)';
    if (!withAliases.includes(callMarker)) {
      throw new Error('Kunde inte hitta EM_ASM-anropet i protocol-46-runtime.');
    }
    return withAliases.replace(
      callMarker,
      // Side modules normally use the upstream runtime's data addresses, which
      // the aliases above cover. Some builds instead retain their own EM_ASM
      // string address. Recover that callback directly from the module memory,
      // just like loadWebAssemblyModule() does for a dynamically loaded module.
      // This keeps an address mismatch from taking the renderer down mid-replay.
      'var callback=ASM_CONSTS[emAsmAddr];if(!callback){var body=UTF8ToString(emAsmAddr);if(body){var params=[];for(var arity=0;;arity++){var argName="$"+arity;if(!body.includes(argName))break;params.push(argName)}try{callback=ASM_CONSTS[emAsmAddr]=eval(`(${params.join(",")}) => { ${body} };`)}catch(error){console.error(`[HLTV] Kunde inte återskapa EM_ASM ${emAsmAddr}: ${error}`)}}}if(typeof callback!=="function"){throw new Error(`[HLTV] Okänd EM_ASM-adress: ${emAsmAddr}`)}return callback(...args)',
    );
  },
});

export default defineConfig({
  base: '/',
  // Xash3D imports its generated glue via a relative module path. Vite's
  // dependency optimizer otherwise bundles that import before resolve.alias
  // runs, which makes the dev server use the npm glue with the locally patched
  // protocol-46 WASM binary. Keep it as normal source so the alias below is
  // applied in development as well as in production builds.
  optimizeDeps: {
    exclude: ['xash3d-fwgs'],
  },
  worker: {
    format: 'es',
  },
  plugins: [
    protocol46AsmCompatibilityPlugin(),
    vue(),
    localDemoPlugin(),
    localArchivePlugin(),
    localCommentsPlugin(),
    localGameAssetsPlugin(),
  ],
  resolve: {
    alias: [
      {
        find: '/@',
        replacement: resolve(projectDirectory, './src'),
      },
      {
        // The protocol-46 WASM has different EM_ASM addresses, so it must use
        // the JavaScript glue emitted by that exact build.
        find: /^\.\/generated\/xash$/,
        replacement: resolve(projectDirectory, './src/vendor/xash-protocol46.js'),
      },
    ],
  },
});
