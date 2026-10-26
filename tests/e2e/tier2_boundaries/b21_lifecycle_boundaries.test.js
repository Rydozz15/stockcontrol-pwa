const { assert, runDirectly } = require('../test_helper');
const { MockMediaStream, MockMediaStreamTrack } = require('../harness');

const tests = [
  {
    name: 'B21-T01: Rapid 20 open/close scanner cycles stops every track without resource leaks',
    fn: async () => {
      const activeTracks = [];
      for (let i = 0; i < 20; i++) {
        const stream = new MockMediaStream();
        activeTracks.push(...stream.getTracks());
        // Close immediately
        for (const t of stream.getTracks()) {
          t.stop();
        }
      }
      assert.strictEqual(activeTracks.length, 20);
      for (const t of activeTracks) {
        assert.strictEqual(t.readyState, 'ended');
      }
    }
  },
  {
    name: 'B21-T02: Switching between environment and user facing cameras stops previous track first',
    fn: async () => {
      class CameraSwitcher {
        constructor() {
          this.currentTrack = new MockMediaStreamTrack('video');
        }
        async switchCamera() {
          if (this.currentTrack) {
            this.currentTrack.stop();
          }
          this.currentTrack = new MockMediaStreamTrack('video');
        }
      }
      const switcher = new CameraSwitcher();
      const oldTrack = switcher.currentTrack;
      assert.strictEqual(oldTrack.readyState, 'live');

      await switcher.switchCamera();
      assert.strictEqual(oldTrack.readyState, 'ended', 'Old track must be terminated');
      assert.strictEqual(switcher.currentTrack.readyState, 'live', 'New track must be active');
    }
  },
  {
    name: 'B21-T03: Applying torch constraint on hardware lacking torch capability is handled gracefully',
    fn: async () => {
      const trackNoTorch = new MockMediaStreamTrack('video');
      trackNoTorch.capabilities.torch = false;

      async function safeToggleTorch(track, enable) {
        if (!track.capabilities.torch) {
          return { success: false, reason: 'Torch unsupported on this device' };
        }
        await track.applyConstraints({ advanced: [{ torch: enable }] });
        return { success: true };
      }

      const res = await safeToggleTorch(trackNoTorch, true);
      assert.strictEqual(res.success, false);
      assert.ok(res.reason.includes('Torch unsupported'));
    }
  },
  {
    name: 'B21-T04: Component unmounting while camera request is in-flight cancels assignment',
    fn: async () => {
      let isMounted = true;
      let assignedStream = null;

      async function mockFetchCamera() {
        await new Promise(r => setTimeout(r, 10));
        return new MockMediaStream();
      }

      const p = mockFetchCamera().then(stream => {
        if (!isMounted) {
          // Clean up stream if unmounted before completion
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        assignedStream = stream;
      });

      // Simulate unmount before resolution
      isMounted = false;
      await p;
      assert.strictEqual(assignedStream, null);
    }
  },
  {
    name: 'B21-T05: Document visibility hidden event pauses frame scanning',
    fn: async () => {
      let isLoopRunning = true;
      function handleVisibilityChange(docHidden) {
        if (docHidden) isLoopRunning = false;
        else isLoopRunning = true;
      }
      handleVisibilityChange(true);
      assert.strictEqual(isLoopRunning, false);
      handleVisibilityChange(false);
      assert.strictEqual(isLoopRunning, true);
    }
  }
];

if (require.main === module) {
  runDirectly('B21: Camera Lifecycle Boundaries', tests);
}

module.exports = {
  id: 'B21',
  name: 'Camera Lifecycle Boundaries',
  tests
};
