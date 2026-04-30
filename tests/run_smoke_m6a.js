// run_smoke_m6a.js -- verify help_text.js data structure
//
// Pure Node test (no browser): loads help_text.js as a module and
// validates it has all expected keys, the right number of params and
// diagnostics, and substantial content with the right topic markers.
//
// Expected: 18/18 PASS.
//
// Usage:
//   node run_smoke_m6a.js

const path = require('path');

const REPO_DIR = path.resolve(__dirname, '..');
const helpText = require(path.join(REPO_DIR, 'help_text.js'));

let nPass = 0, nFail = 0;
const log = (m) => console.log(m);
const pass = (m) => { nPass++; log('[PASS] ' + m); };
const fail = (m) => { nFail++; log('[FAIL] ' + m); };

// Required top-level keys
const TOP_KEYS = ['helpHeader', 'params', 'diagnostics', 'aboutText', 'version'];
for (const k of TOP_KEYS) {
  if (k in helpText) pass(`Top-level key "${k}" present`);
  else fail(`Missing top-level key "${k}"`);
}

if (typeof helpText.helpHeader === 'string' && helpText.helpHeader.length > 100)
  pass(`helpHeader is string (${helpText.helpHeader.length} chars)`);
else fail(`helpHeader malformed`);

const EXPECTED_PARAMS = [
  'dt','energyLoss','vRestThreshold','timerPeriod',
  'Nparticles','particleMass','particleRadius','edgeGap',
  'sourceMass','stellarRadius','periapsis','eccentricity',
  'vInfinity','impactAngle','M1','M2','binarySep','binaryEcc',
  'binaryStartPhase','circumbinaryRatio','swirlFactor','sigma_v'
];
let missingParams = 0;
for (const p of EXPECTED_PARAMS) {
  if (!(p in helpText.params)) { fail(`Missing param: ${p}`); missingParams++; }
}
if (missingParams === 0) pass(`All 22 params present`);

let malformed = 0;
for (const p of EXPECTED_PARAMS) {
  const e = helpText.params[p];
  if (!e) continue;
  if (typeof e.label !== 'string' || e.label.length === 0) { fail(`${p}: missing label`); malformed++; }
  if (typeof e.units !== 'string') { fail(`${p}: missing units`); malformed++; }
  if (typeof e.description !== 'string' || e.description.length < 50) {
    fail(`${p}: description too short (${e.description?.length} chars)`); malformed++;
  }
}
if (malformed === 0) pass(`All params have well-formed {label, units, description}`);

const EXPECTED_DIAGS = ['t', 'sep', 'COM_v', 'bound', 'E', 'L_z'];
let missingDiags = 0;
for (const d of EXPECTED_DIAGS) {
  if (!(d in helpText.diagnostics)) { fail(`Missing diagnostic: ${d}`); missingDiags++; }
}
if (missingDiags === 0) pass(`All 6 diagnostics present`);

if (Array.isArray(helpText.aboutText)) {
  pass(`aboutText is an array (${helpText.aboutText.length} entries)`);
  const totalChars = helpText.aboutText.join('').length;
  if (totalChars > 3000) pass(`aboutText has substantial content (${totalChars} chars)`);
  else fail(`aboutText too short: ${totalChars} chars`);
  const allText = helpText.aboutText.join(' ');
  const markers = ['PHYSICS', '2D vs 3D ROCHE', 'EXPERIMENTS', 'Velocity-Verlet', 'Lagrange', 'Roche'];
  for (const m of markers) {
    if (allText.toLowerCase().includes(m.toLowerCase())) pass(`aboutText mentions "${m}"`);
    else fail(`aboutText missing topic: ${m}`);
  }
} else fail(`aboutText is not an array`);

const totalSize = JSON.stringify(helpText).length;
if (totalSize > 5000 && totalSize < 50000)
  pass(`Total help payload size = ${totalSize} bytes (sensible)`);
else fail(`Unexpected payload size: ${totalSize}`);

console.log(`\n=== ${nPass} PASS, ${nFail} FAIL ===`);
process.exit(nFail > 0 ? 1 : 0);
