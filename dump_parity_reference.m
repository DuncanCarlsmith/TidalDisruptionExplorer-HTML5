function dump_parity_reference()
% DUMP_PARITY_REFERENCE  Generate physics_reference.json for the HTML5 port.
%
% Computes a battery of reference values from the original MATLAB
% physics, IC, and Roche code, and writes them to JSON for use by the
% JavaScript parity test page.
%
% The script does NOT modify any files in the
% TidalDisruptionExplorerMATLAB/ source folder. It only adds the source
% folder to the path so it can call the existing functions, plus
% includes a local copy of computeRocheRadii (private to the main
% Live Script in MATLAB) so we can call it standalone here.
%
% Output: physics_reference.json next to this script.
%
% Author: Duncan Carlsmith / Claude.ai port helper, 2026.

    thisDir = fileparts(mfilename('fullpath'));
    matlabSrcDir = '/Users/duncancarlsmith/Documents/MATLAB/Roche limit/TidalDisruptionExplorerMATLAB/TidalDisruptionExplorer folder';
    addpath(matlabSrcDir);

    fns = physics_core();   % file is named physics_core.m, function is physics_core_v6
    ref = struct();
    ref.meta = struct( ...
        'description', 'Physics reference values for the HTML5 port parity test', ...
        'source',      matlabSrcDir, ...
        'matlabVer',   version, ...
        'date',        datestr(now, 'yyyy-mm-dd HH:MM:SS'));

    %% ---- Category A.1: hexPackedOffsets -----------------------------
    fprintf('A.1 hexPackedOffsets...\n');
    offsets = fns.hexPackedOffsets(19, 3.2, 1.0);
    ref.hexN19_pr3_2_eg1 = struct( ...
        'inputs', struct('N', 19, 'particleRadius', 3.2, 'edgeGap', 1.0), ...
        'offsets', offsets);   % 19x2 matrix

    %% ---- Category A.2: computeRocheRadii ----------------------------
    fprintf('A.2 computeRocheRadii...\n');

    % Three test cases that mirror the MATLAB v9 verification
    cfg_single = makeCfg('single', 'parabolic');
    cfg_single.sourceMass = 1250;
    [r3a, rda] = computeRocheRadii_local(cfg_single);
    ref.roche_single_1250 = struct( ...
        'inputs',    cfgSubset(cfg_single), ...
        'rocheR_3D', r3a, ...
        'rocheR_disk', rda);

    cfg_eq = makeCfg('binary', 'parabolic');
    cfg_eq.M1 = 150; cfg_eq.M2 = 150;
    [r3b, rdb] = computeRocheRadii_local(cfg_eq);
    ref.roche_binary_eq_150 = struct( ...
        'inputs',    cfgSubset(cfg_eq), ...
        'rocheR_3D', r3b, ...
        'rocheR_disk', rdb);

    cfg_uneq = makeCfg('binary', 'parabolic');
    cfg_uneq.M1 = 1000; cfg_uneq.M2 = 250;
    [r3c, rdc] = computeRocheRadii_local(cfg_uneq);
    ref.roche_binary_uneq_1000_250 = struct( ...
        'inputs',    cfgSubset(cfg_uneq), ...
        'rocheR_3D', r3c, ...
        'rocheR_disk', rdc);

    %% ---- Category A.3: lagrange_point -------------------------------
    fprintf('A.3 lagrange_point...\n');
    pts = {'L1','L2','L3','L4','L5'};

    % Case 1: M1=M2=150, a=50
    L_eq = zeros(5,2);
    for k = 1:5
        [xL, yL] = lagrange_point(150, 150, 50, pts{k});
        L_eq(k,:) = [xL, yL];
    end
    ref.lagrange_eq = struct( ...
        'inputs', struct('M1', 150, 'M2', 150, 'a', 50), ...
        'points', {pts}, ...
        'xy',     L_eq);

    % Case 2: M1=1000, M2=250, a=50
    L_uneq = zeros(5,2);
    for k = 1:5
        [xL, yL] = lagrange_point(1000, 250, 50, pts{k});
        L_uneq(k,:) = [xL, yL];
    end
    ref.lagrange_uneq = struct( ...
        'inputs', struct('M1', 1000, 'M2', 250, 'a', 50), ...
        'points', {pts}, ...
        'xy',     L_uneq);

    %% ---- Category A.4: binary_ic ------------------------------------
    fprintf('A.4 binary_ic...\n');
    s = binary_ic(150, 150, 50, 0, 0);
    ref.binary_ic_eq_circ = struct( ...
        'inputs', struct('M1', 150, 'M2', 150, 'a', 50, 'e', 0, 'phase', 0), ...
        's1', sourceToVec(s(1)), ...
        's2', sourceToVec(s(2)));

    % And one with eccentricity and phase to catch sign errors
    s2 = binary_ic(1000, 250, 80, 0.4, pi/3);
    ref.binary_ic_uneq_ecc = struct( ...
        'inputs', struct('M1', 1000, 'M2', 250, 'a', 80, 'e', 0.4, 'phase', pi/3), ...
        's1', sourceToVec(s2(1)), ...
        's2', sourceToVec(s2(2)));

    %% ---- Category A.5: cluster_ic for all 7 scenario+IC combos ------
    fprintf('A.5 cluster_ic...\n');
    cluster_cases = {
        'single', 'circular';
        'single', 'elliptical';
        'single', 'parabolic';
        'single', 'hyperbolic';
        'binary', 'lagrange';
        'binary', 'circumbinary';
        'binary', 'parabolic';
    };
    cluster_ic_out = struct();
    for k = 1:size(cluster_cases, 1)
        typeStr = cluster_cases{k,1};
        icStr   = cluster_cases{k,2};
        cfgK = makeCfg(typeStr, icStr);
        Mc = cfgK.particleMass * cfgK.Nparticles;
        scenario = struct('type', string(typeStr), 'ic', string(icStr));
        params = struct( ...
            'sourceMass',        cfgK.sourceMass, ...
            'M1',                cfgK.M1, ...
            'M2',                cfgK.M2, ...
            'clusterMass',       Mc, ...
            'periapsis',         cfgK.periapsis, ...
            'eccentricity',      cfgK.eccentricity, ...
            'vInfinity',         cfgK.vInfinity, ...
            'lagrangePoint',     cfgK.lagrangePoint, ...
            'circumbinaryRatio', cfgK.circumbinaryRatio, ...
            'impactAngle',       cfgK.impactAngle, ...
            'binarySep',         cfgK.binarySep);
        [x, y, vx, vy] = cluster_ic(scenario, params);
        keyName = sprintf('%s_%s', typeStr, icStr);
        cluster_ic_out.(keyName) = struct( ...
            'inputs', cfgSubset(cfgK), ...
            'x', x, 'y', y, 'vx', vx, 'vy', vy);
    end
    ref.cluster_ic = cluster_ic_out;

    %% ---- Category B: single Verlet step, deterministic state --------
    fprintf('B   single verletStep...\n');
    [s_init, p_init, cfgB] = makeDeterministicState();
    [s0, p0] = fns.computeAccelerations(s_init, p_init, ...
                                         cfgB.particleMass, cfgB.stellarRadius, ...
                                         cfgB.particleRadius);
    [s1, p1] = fns.verletStep(s0, p0, ...
                               cfgB.particleMass, cfgB.stellarRadius, ...
                               cfgB.energyLoss, cfgB.particleRadius, cfgB.dt, ...
                               cfgB.vRestThreshold);
    ref.verlet_initial = struct( ...
        'cfg',       cfgB, ...
        'sources',   sourcesToMat(s0), ...
        'particles', p0);
    ref.verlet_step1 = struct( ...
        'sources',   sourcesToMat(s1), ...
        'particles', p1);

    %% ---- Category C: 100-step trajectory from same state ------------
    fprintf('C   100-step verletStep...\n');
    s = s0; p = p0;
    for kStep = 1:100
        [s, p] = fns.verletStep(s, p, ...
                                 cfgB.particleMass, cfgB.stellarRadius, ...
                                 cfgB.energyLoss, cfgB.particleRadius, cfgB.dt, ...
                                 cfgB.vRestThreshold);
    end
    E100 = fns.totalEnergy(s, p, cfgB.particleMass, cfgB.stellarRadius);
    L100 = fns.angularMomentum(s, p, cfgB.particleMass);
    ref.verlet_step100 = struct( ...
        'sources',   sourcesToMat(s), ...
        'particles', p, ...
        'totalEnergy', E100, ...
        'angularMomentum', L100);

    %% ---- write JSON --------------------------------------------------
    outPath = fullfile(thisDir, 'physics_reference.json');
    jsonStr = jsonencode(ref, 'PrettyPrint', true);
    fid = fopen(outPath, 'w');
    if fid < 0
        error('Could not open %s for writing.', outPath);
    end
    fprintf(fid, '%s\n', jsonStr);
    fclose(fid);

    info = dir(outPath);
    fprintf('\nWrote %s (%d bytes)\n', outPath, info.bytes);
end


% =====================================================================
%                 L O C A L   H E L P E R S
% =====================================================================

function cfg = makeCfg(typeStr, icStr)
% Mirror of scenarioDefaults() from TidalDisruptionExplorer.m, with
% a few standard test settings (binarySep, etc).
    cfg = struct( ...
        'scenarioType',      string(typeStr), ...
        'clusterIC',         string(icStr), ...
        'sourceMass',        1250, ...
        'M1',                1250, ...
        'M2',                1250, ...
        'stellarRadius',     15, ...
        'Nparticles',        19, ...
        'particleMass',      1.0, ...
        'particleRadius',    3.2, ...
        'edgeGap',           1.0, ...
        'lagrangePoint',     "L4", ...
        'impactAngle',       0, ...
        'binarySep',         50, ...
        'binaryEcc',         0.0, ...
        'binaryStartPhase',  0, ...
        'circumbinaryRatio', 1.25, ...
        'dt',                0.07, ...
        'energyLoss',        0.30, ...
        'vRestThreshold',    0.05, ...
        'swirlFactor',       0.04, ...
        'sigma_v',           0.003, ...
        'themeMode',         "dark", ...
        'timerPeriod',       0.04);

    if string(typeStr) == "single"
        switch char(icStr)
            case 'circular',   cfg.periapsis = 100; cfg.eccentricity = 0.0; cfg.vInfinity = 0.5;
            case 'elliptical', cfg.periapsis = 100; cfg.eccentricity = 0.5; cfg.vInfinity = 0.5;
            case 'parabolic',  cfg.periapsis = 100; cfg.eccentricity = 0.0; cfg.vInfinity = 0.5;
            case 'hyperbolic', cfg.periapsis = 100; cfg.eccentricity = 0.0; cfg.vInfinity = 0.5;
            otherwise,         cfg.periapsis = 100; cfg.eccentricity = 0.0; cfg.vInfinity = 0.5;
        end
    else
        cfg.M1 = 150; cfg.M2 = 150;
        switch char(icStr)
            case 'lagrange',     cfg.periapsis = 60;  cfg.eccentricity = 0.0; cfg.vInfinity = 0.5;
            case 'circumbinary', cfg.periapsis = 60;  cfg.eccentricity = 0.0; cfg.vInfinity = 0.5;
            case 'parabolic',    cfg.periapsis = 200; cfg.eccentricity = 0.0; cfg.vInfinity = 0.5;
            otherwise,           cfg.periapsis = 60;  cfg.eccentricity = 0.0; cfg.vInfinity = 0.5;
        end
    end
end


function out = cfgSubset(cfg)
% Return the subset of cfg fields that affect the test, for output
% readability (the full cfg has many fields irrelevant to any one test).
    keep = {'scenarioType','clusterIC','sourceMass','M1','M2','stellarRadius', ...
            'Nparticles','particleMass','particleRadius','edgeGap', ...
            'periapsis','eccentricity','vInfinity','lagrangePoint', ...
            'impactAngle','binarySep','binaryEcc','binaryStartPhase', ...
            'circumbinaryRatio','dt','energyLoss','vRestThreshold'};
    out = struct();
    for k = 1:numel(keep)
        if isfield(cfg, keep{k})
            v = cfg.(keep{k});
            if isstring(v), v = char(v); end
            out.(keep{k}) = v;
        end
    end
end


function v = sourceToVec(s)
% Pack a single source struct into [x, y, vx, vy, ax, ay, m] for JSON.
    v = [s.x, s.y, s.vx, s.vy, s.ax, s.ay, s.m];
end


function M = sourcesToMat(s)
% Pack source array into nS x 7 matrix [x, y, vx, vy, ax, ay, m].
    nS = numel(s);
    M = zeros(nS, 7);
    for k = 1:nS
        M(k,:) = sourceToVec(s(k));
    end
end


function [R3D, Rdisk] = computeRocheRadii_local(cfg)
% LOCAL COPY of computeRocheRadii from TidalDisruptionExplorer.m.
% Per Duncan's instruction, we do NOT modify the source file; instead
% we duplicate the math here as an isolated function for testing.
% This must stay numerically identical to the original.

    Mc = cfg.particleMass * cfg.Nparticles;
    Rc = (cfg.particleRadius + cfg.edgeGap/2) * sqrt(cfg.Nparticles);

    if cfg.scenarioType == "binary"
        masses = [cfg.M1, cfg.M2];
    else
        masses = cfg.sourceMass;
    end
    nS = numel(masses);
    R3D   = zeros(1, nS);
    Rdisk = zeros(1, nS);

    R = cfg.stellarRadius;
    if Mc <= 0 || Rc <= 0 || R <= 0, return; end
    rho_s = Mc / ((4/3)*pi*Rc^3);
    if rho_s <= 0, return; end

    h = 2 * cfg.particleRadius;
    if h <= 0 || Rc <= 0
        useDisk = false;
    else
        useDisk = true;
        hr = h / Rc;
        hr = max(0.02, min(0.5, hr));
        log_hr_table  = log10([0.02, 0.05, 0.10, 0.20, 0.50]);
        g_ratio_table = [3.62, 3.04, 2.60, 2.16, 1.58];
        g_ratio = interp1(log_hr_table, g_ratio_table, log10(hr), 'linear');
    end

    for k = 1:nS
        M = masses(k);
        if M <= 0, continue; end
        rho_M    = M / ((4/3)*pi*R^3);
        R3D(k)   = R * (2 * rho_M / rho_s)^(1/3);
        if useDisk
            Rdisk(k) = R3D(k) * (1 / g_ratio)^(1/3);
        else
            Rdisk(k) = R3D(k);
        end
    end
end


function [sources, particles, cfg] = makeDeterministicState()
% Build a known initial state with NO randomness, suitable for
% exact MATLAB-vs-JS comparison of Verlet steps.
%
% Configuration: binary equal-mass with a 7-particle hex cluster
% placed at the periapsis of a parabolic flyby orbit. We bypass
% cluster_ic and binary_ic and just hard-code coordinates so that
% the test starts from a guaranteed identical state on both sides.

    cfg = struct( ...
        'particleMass',   1.0, ...
        'stellarRadius',  15, ...
        'particleRadius', 3.2, ...
        'edgeGap',        1.0, ...
        'energyLoss',     0.30, ...
        'vRestThreshold', 0.05, ...
        'dt',             0.07);

    % Two equal-mass sources straddling the origin
    s1.x = -25; s1.y = 0; s1.vx = 0; s1.vy = -0.9; s1.ax = 0; s1.ay = 0; s1.m = 150;
    s2.x = +25; s2.y = 0; s2.vx = 0; s2.vy = +0.9; s2.ax = 0; s2.ay = 0; s2.m = 150;
    sources = [s1, s2];

    % 7-particle hex cluster placed at (200, 0), zero velocity
    spacing = 2*cfg.particleRadius + cfg.edgeGap;
    offsets = [
         0,  0;
         1,  0;
        -1,  0;
         0.5,  sqrt(3)/2;
        -0.5,  sqrt(3)/2;
         0.5, -sqrt(3)/2;
        -0.5, -sqrt(3)/2;
        ] * spacing;
    cx = 200; cy = 0;
    nP = size(offsets, 1);
    particles = zeros(nP, 6);
    for k = 1:nP
        particles(k, 1) = cx + offsets(k, 1);
        particles(k, 2) = cy + offsets(k, 2);
        particles(k, 3) = 0;     % vx
        particles(k, 4) = 0;     % vy
        particles(k, 5) = 0;     % ax
        particles(k, 6) = 0;     % ay
    end
end
