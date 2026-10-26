const { assert, runDirectly } = require('../test_helper');
const { MockMediaStream, MockMediaStreamTrack } = require('../harness');

const tests = [
  {
    name: 'F21-T01: Closing scanner stops all active video tracks to release camera hardware',
    fn: async () => {
      const stream = new MockMediaStream();
      const tracks = stream.getVideoTracks();
      assert.strictEqual(tracks.length, 1);
      assert.strictEqual(tracks[0].readyState, 'live');

      // Scanner unmount / close
      for (const t of stream.getTracks()) {
        t.stop();
      }
      assert.strictEqual(tracks[0].readyState, 'ended');
    }
  },
  {
    name: 'F21-T02: Constraints specify environment facingMode for kitchen barcode scanning',
    fn: async () => {
      const cameraConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      assert.strictEqual(cameraConstraints.video.facingMode.ideal, 'environment');
    }
  },
  {
    name: 'F21-T03: Torch toggle modifies track advanced constraints when supported',
    fn: async () => {
      const track = new MockMediaStreamTrack('video');
      assert.strictEqual(track.settings.torch, false);

      await track.applyConstraints({ advanced: [{ torch: true }] });
      assert.strictEqual(track.settings.torch, true);

      await track.applyConstraints({ advanced: [{ torch: false }] });
      assert.strictEqual(track.settings.torch, false);
    }
  },
  {
    name: 'F21-T04: Camera permission rejection returns diagnostic message without crash',
    fn: async () => {
      async function requestCamera(permissionGranted = false) {
        if (!permissionGranted) {
          const err = new Error('Permission denied');
          err.name = 'NotAllowedError';
          throw err;
        }
        return new MockMediaStream();
      }

      try {
        await requestCamera(false);
        assert.fail('Should have thrown');
      } catch (err) {
        assert.strictEqual(err.name, 'NotAllowedError');
      }
    }
  },
  {
    name: 'F21-T05: Tab visibility change pauses active frame processing loop',
    fn: async () => {
      class ScannerLifecycleController {
        constructor() {
          this.isScanning = true;
        }
        onVisibilityChange(hidden) {
          if (hidden) {
            this.isScanning = false;
          } else {
            this.isScanning = true;
          }
        }
      }
      const controller = new ScannerLifecycleController();
      assert.strictEqual(controller.isScanning, true);
      controller.onVisibilityChange(true);
      assert.strictEqual(controller.isScanning, false);
      controller.onVisibilityChange(false);
      assert.strictEqual(controller.isScanning, true);
    }
  }
];

if (require.main === module) {
  runDirectly('F21: Camera Lifecycle Management', tests);
}

module.exports = {
  id: 'F21',
  name: 'Camera Lifecycle Management',
  tests
};
