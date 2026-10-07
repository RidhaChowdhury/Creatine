const mockPlayer = {
   seekTo: jest.fn(async () => undefined),
   play: jest.fn(),
   pause: jest.fn(),
   volume: 1
};
const mockCreateAudioPlayer = jest.fn((_source?: unknown) => mockPlayer);
const mockImpactAsync = jest.fn(async (_style?: unknown) => undefined);
const mockNotificationAsync = jest.fn(async (_type?: unknown) => undefined);
const mockSelectionAsync = jest.fn(async () => undefined);

jest.mock('expo-audio', () => ({ createAudioPlayer: (source?: unknown) => mockCreateAudioPlayer(source) }));
jest.mock('expo-haptics', () => ({
   impactAsync: (style?: unknown) => mockImpactAsync(style),
   notificationAsync: (type?: unknown) => mockNotificationAsync(type),
   selectionAsync: () => mockSelectionAsync(),
   ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
   NotificationFeedbackType: { Success: 'success', Error: 'error' }
}));
jest.mock('react-native', () => {
   return { Platform: { OS: 'android' } };
});

const enabled = { soundEnabled: true, vibrationEnabled: true, motion: 'full' as const };

describe('interactionFeedback', () => {
   let now = 100;
   beforeEach(() => {
      jest.resetModules();
      jest.clearAllMocks();
      now = 100;
      jest.spyOn(performance, 'now').mockImplementation(() => now);
   });

   afterEach(() => {
      jest.restoreAllMocks();
   });

   function loadFeedback() {
      return require('../interaction-feedback') as typeof import('../interaction-feedback');
   }

   it('does not create audio or haptics when both outputs are muted', async () => {
      const { interactionFeedback } = await loadFeedback();

      await interactionFeedback('water', { ...enabled, soundEnabled: false, vibrationEnabled: false });

      expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
      expect(mockImpactAsync).not.toHaveBeenCalled();
      expect(mockNotificationAsync).not.toHaveBeenCalled();
   });

   it('keeps haptics independent from sound', async () => {
      const { interactionFeedback } = await loadFeedback();

      await interactionFeedback('water', { ...enabled, soundEnabled: false });
      expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
      expect(mockImpactAsync).toHaveBeenCalledWith('light');

      jest.resetModules();
      jest.clearAllMocks();
      now += 66;
      const soundOnly = await loadFeedback();
      await soundOnly.interactionFeedback('water', { ...enabled, vibrationEnabled: false });
      expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
      expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
      expect(mockPlayer.play).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).not.toHaveBeenCalled();
   });

   it('suppresses all effects when the app is inactive', async () => {
      const { interactionFeedback } = await loadFeedback();

      await interactionFeedback('supplement', enabled, false);

      expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
      expect(mockImpactAsync).not.toHaveBeenCalled();
   });

   it('plays water, supplement, and undo success feedback with their intended haptics', async () => {
      const { interactionFeedback } = await loadFeedback();

      await interactionFeedback('water', enabled);
      now += 66;
      await interactionFeedback('supplement', enabled);
      now += 66;
      await interactionFeedback('undo', enabled);

      expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(3);
      expect(mockPlayer.play).toHaveBeenCalledTimes(3);
      expect(mockImpactAsync.mock.calls).toEqual([['light'], ['medium'], ['light']]);
   });

   it('keeps the 65 ms throttle and resets its module state between imports', async () => {
      const firstImport = await loadFeedback();

      await firstImport.interactionFeedback('water', enabled);
      await firstImport.interactionFeedback('supplement', enabled);
      expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).toHaveBeenCalledTimes(1);

      jest.resetModules();
      jest.clearAllMocks();
      const freshImport = await loadFeedback();
      await freshImport.interactionFeedback('water', enabled);

      expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).toHaveBeenCalledTimes(1);
   });
});
