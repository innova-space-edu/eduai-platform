import assert from "node:assert/strict";
import {
  BONSAI_REFERENCE_MODELS,
  EFFICIENCY_MODELS,
  getAdaptiveWllamaTuning,
  planUniversalEfficiency,
  type EfficiencyEngine,
  type EfficiencyInput,
  type EfficiencyModel,
} from "../lib/ai/local/eduai-efficiency-adapter";

const nano = EFFICIENCY_MODELS.find((m) => m.id === "eduai-local-lfm-350m") as EfficiencyModel;
const large = BONSAI_REFERENCE_MODELS.find((m) => m.id === "bonsai2-27b") as EfficiencyModel;
const small = BONSAI_REFERENCE_MODELS.find((m) => m.id === "bonsai2-2b") as EfficiencyModel;
assert.ok(nano && large && small);
assert.equal(BONSAI_REFERENCE_MODELS.length, 4);
assert.deepEqual(BONSAI_REFERENCE_MODELS.map((m) => m.weightsMB), [430, 950, 2000, 5950]);

function input(model: EfficiencyModel, engine: EfficiencyEngine = "browser-wllama"): EfficiencyInput {
  return {
    model, engine,
    hardware: {
      ramGB: 8, vramGB: 4, webgpu: true, cpuThreads: 8,
      freeStorageMB: 32000, persistentStorage: false, online: true,
    },
    cachedOnDisk: true, nativeBackendVerified: false,
    serverEndpointVerified: false, allowRemoteInference: false,
    dataSensitivity: "internal", includeVision: false,
  };
}

const browserNano = planUniversalEfficiency(input(nano));
assert.equal(browserNano.status, "ready-to-test");
assert.equal(browserNano.executionTier, "RAM/VRAM");
assert.equal(browserNano.gpuOffload, "not-confirmed");
assert.equal(browserNano.chosenContext, 2048);
assert.equal(browserNano.batchSize, 64);

const browserBonsai = planUniversalEfficiency(input(small));
assert.equal(browserBonsai.status, "blocked", "ternary model must NEVER be sent to wllama");
assert.equal(browserBonsai.executionTier, "No disponible");

const nativeUnverified = planUniversalEfficiency(input(small, "native-prism"));
assert.equal(nativeUnverified.status, "blocked", "Prism native must verify runtime");

const nativeReady = input(small, "native-prism");
nativeReady.nativeBackendVerified = true;
const nativePlan = planUniversalEfficiency(nativeReady);
assert.equal(nativePlan.executionTier, "SSD + mmap");
assert.equal(nativePlan.status, "ready-to-test", "only planning stage, never runtime measurement");

const nativeCold = input(small, "native-prism");
nativeCold.nativeBackendVerified = true;
nativeCold.cachedOnDisk = false;
assert.equal(planUniversalEfficiency(nativeCold).status, "requires-verification");

const nativeBig = input(large, "native-prism");
nativeBig.nativeBackendVerified = true;
nativeBig.hardware.ramGB = 8;
const bigPlan = planUniversalEfficiency(nativeBig);
assert.equal(bigPlan.status, "requires-verification");
assert.ok(bigPlan.estimatedRuntimeBudgetMB > 0);

const noSpace = input(nano);
noSpace.cachedOnDisk = false;
noSpace.hardware.freeStorageMB = 100;
assert.equal(planUniversalEfficiency(noSpace).status, "blocked");

const unknownStorage = input(nano);
unknownStorage.cachedOnDisk = false;
unknownStorage.hardware.freeStorageMB = null;
assert.equal(planUniversalEfficiency(unknownStorage).status, "ready-to-test");
assert.ok(planUniversalEfficiency(unknownStorage).warnings.some((w) => /Cuota/.test(w)));

const remoteBase = input(small, "remote-server");
remoteBase.hardware.freeStorageMB = 0; // must not block purely on browser disk quota
remoteBase.serverEndpointVerified = true;
remoteBase.allowRemoteInference = true;
remoteBase.dataSensitivity = "public";
assert.equal(planUniversalEfficiency(remoteBase).status, "requires-verification");
assert.equal(planUniversalEfficiency(remoteBase).storageTier, "remoto");

const remoteSensitive = input(small, "remote-server");
remoteSensitive.serverEndpointVerified = true;
remoteSensitive.allowRemoteInference = true;
remoteSensitive.dataSensitivity = "sensitive";
assert.equal(planUniversalEfficiency(remoteSensitive).status, "blocked");

const remoteNotConsented = input(small, "remote-server");
remoteNotConsented.serverEndpointVerified = true;
remoteNotConsented.dataSensitivity = "public";
assert.equal(planUniversalEfficiency(remoteNotConsented).status, "blocked");

const noMemory = input(nano);
noMemory.hardware.ramGB = null;
assert.equal(planUniversalEfficiency(noMemory).status, "requires-verification");

const tooLarge = input(large);
tooLarge.model = { ...large, engine: "wllama" };
assert.equal(planUniversalEfficiency(tooLarge).status, "blocked");

assert.deepEqual(getAdaptiveWllamaTuning(4, 4096), { n_ctx: 1024, n_batch: 32 });
assert.deepEqual(getAdaptiveWllamaTuning(8, 4096), { n_ctx: 2048, n_batch: 64 });
assert.deepEqual(getAdaptiveWllamaTuning(16, 4096), { n_ctx: 4096, n_batch: 128 });
assert.deepEqual(getAdaptiveWllamaTuning(null, 4096), { n_ctx: 1024, n_batch: 32 });
assert.deepEqual(getAdaptiveWllamaTuning(4, 768), { n_ctx: 768, n_batch: 32 });

const invalid: EfficiencyModel = { ...nano, weightsMB: 0 };
assert.equal(planUniversalEfficiency(input(invalid)).status, "blocked");

const vision = input(small, "native-prism");
vision.nativeBackendVerified = true;
vision.includeVision = true;
assert.equal(planUniversalEfficiency(vision).requiredDiskMB, small.weightsMB + small.visionProjectorMB!);

console.log("Universal Efficiency Adapter V1: 19 safety and planning checks passed");
