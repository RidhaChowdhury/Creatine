import { useCallback, useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { Canvas, Group, Path, Skia, Text as SkiaText, useFont, useCanvasRef } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { waterSurface, type WaterImpulse } from './WaterMotion';

type Props = { width: number; height: number; level: number; valueText: string; amount: number; unit: string;
  numberX: number; numberBaseline: number; fontSize: number; active: boolean; reducedMotion: boolean; impulse?: WaterImpulse };

/** The blue fill and the submerged glyphs use the very same Skia path. */
export function WaterScene(props: Props) {
  const host = useRef<View>(null);
  const canvas = useCanvasRef();
  const attachHost = useCallback((view: View | null) => {
    host.current = view;
    if (Platform.OS !== 'web' || !view) return;
    // Initialize before Skia's layout callback creates its surface. A preserved
    // buffer keeps a static/reduced-motion scene intact during DOM compositing.
    (view as unknown as HTMLElement).querySelector('canvas')?.getContext('webgl2', {
      alpha: true, depth: true, stencil: true, antialias: false,
      premultipliedAlpha: true, preserveDrawingBuffer: true,
    });
  }, []);
  const font = useFont(require('@expo-google-fonts/barlow-condensed/600SemiBold/BarlowCondensed_600SemiBold.ttf'), props.fontSize);
  const smallFont = useFont(require('@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf'), 20);
  useEffect(() => {
    if (Platform.OS !== 'web' || !font || !smallFont) return;
    // Skia 2.2's web renderer forces Display P3, ignoring Canvas.colorSpace.
    // Match the sRGB design tokens and the surrounding native/web controls.
    const element = host.current as unknown as HTMLElement | null;
    let request = 0;
    const applyColorSpace = () => {
      cancelAnimationFrame(request);
      request = requestAnimationFrame(() => {
        const context = element?.querySelector('canvas')?.getContext('webgl2');
        if (context && context.drawingBufferColorSpace !== 'srgb') {
          context.drawingBufferColorSpace = 'srgb';
          // Changing the WebGL buffer color space invalidates its contents.
          // Reduced motion has no animation frame to repaint them for us.
          canvas.current?.redraw();
        }
      });
    };
    applyColorSpace();
    const webCanvas = element?.querySelector('canvas');
    const repaint = () => {
      applyColorSpace();
      canvas.current?.redraw();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') repaint(); };
    webCanvas?.addEventListener('webglcontextrestored', repaint);
    document.addEventListener('visibilitychange', onVisible);
    const observer = new ResizeObserver(applyColorSpace);
    if (element) observer.observe(element);
    return () => {
      cancelAnimationFrame(request); observer.disconnect();
      webCanvas?.removeEventListener('webglcontextrestored', repaint);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [font, smallFont, props.width, props.height]);
  const clock = useSharedValue(0);
  const level = useSharedValue(props.level);
  const amount = useSharedValue(props.amount);
  const impulseAt = useSharedValue(-100000);
  const origin = useSharedValue(.5);
  const frame = useFrameCallback(info => { clock.value += Math.min(info.timeSincePreviousFrame ?? 16, 50); }, false);
  useEffect(() => {
    frame.setActive(props.active && !props.reducedMotion);
    if (!props.active) impulseAt.value = -100000;
    return () => frame.setActive(false);
  }, [props.active, props.reducedMotion, frame, impulseAt]);
  useEffect(() => {
    const immediate = props.reducedMotion || !props.active;
    level.value = immediate ? props.level : withSpring(props.level, { stiffness: 115, damping: 21, mass: 1 });
    amount.value = immediate ? props.amount : withTiming(props.amount, { duration: 420 });
  }, [props.level, props.amount, props.reducedMotion, props.active, level, amount]);
  useEffect(() => {
    if (props.impulse && props.active && !props.reducedMotion) { impulseAt.value = clock.value; origin.value = props.impulse.origin; }
  }, [props.impulse?.id]);
  const surface = useDerivedValue(() => waterSurface(props.width, props.height, level.value, clock.value, clock.value - impulseAt.value, origin.value, props.reducedMotion));
  const edge = useDerivedValue(() => {
    const path = Skia.Path.Make();
    surface.value.points.forEach((point, index) => index ? path.lineTo(point.x, point.y) : path.moveTo(point.x, point.y));
    return path;
  });
  const fill = useDerivedValue(() => {
    const path = edge.value.copy(); path.lineTo(props.width, props.height); path.lineTo(0, props.height); path.close(); return path;
  });
  const counter = useDerivedValue(() => Math.abs(amount.value - props.amount) < .001 ? props.valueText
    : props.unit === 'oz' || props.unit === 'ml' ? String(Math.round(amount.value)) : String(Math.round(amount.value * 100) / 100));
  const unitX = useDerivedValue(() => props.numberX + (font ? font.getGlyphWidths(font.getGlyphIDs(counter.value)).reduce((sum, width) => sum + width, 0) : 0) + 18);
  const reflection = useDerivedValue(() => props.reducedMotion ? .12 : .12 + Math.exp(-(clock.value - impulseAt.value) / 550) * .2);
  if (!font || !smallFont || props.width <= 0 || props.height <= 0) return null;
  return <View ref={attachHost} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} accessible={false}>
  <Canvas ref={canvas} style={{ width: props.width, height: props.height }} colorSpace="srgb" pointerEvents="none" accessible={false}>
    <Path path={fill} color="#398eff" />
    <Path path={edge} color="#e9e9e9" style="stroke" strokeWidth={1} opacity={reflection} />
    <SkiaText x={props.numberX} y={props.numberBaseline} text={counter} font={font} color="#e9e9e9" />
    <SkiaText x={unitX} y={props.numberBaseline} text={props.unit} font={smallFont} color="#e9e9e9" />
    <Group clip={fill}>
      <SkiaText x={props.numberX} y={props.numberBaseline} text={counter} font={font} color="#0c0c0c" />
      <SkiaText x={unitX} y={props.numberBaseline} text={props.unit} font={smallFont} color="#0c0c0c" />
    </Group>
  </Canvas></View>;
}
