import { useWindowDimensions } from "react-native";
import {
  Canvas,
  Path,
  Skia,
  useClock,
  vec,
  LinearGradient,
} from "@shopify/react-native-skia";
import { useDerivedValue, withTiming } from "react-native-reanimated";

interface WaveBackgroundProps {
  progressPercent: number; // 0-1 (0 = bottom, 1 = top)
  colors?: [string, string];
  amplitude?: number;
  offsetPercentage?: number; // Configurable offset (default 20%)
}

export const WaveBackground = ({
  progressPercent = 0.5,
  colors = ["#2B4593", "#002147"],
  amplitude = 10,
  offsetPercentage = 20, // Default 20% offset
}: WaveBackgroundProps) => {
  const { width, height } = useWindowDimensions();
  const clock = useClock();

  // Smooth progress interpolation
  const animatedProgress = useDerivedValue(() => {
    return withTiming(progressPercent, { duration: 1000 });
  }, [progressPercent]);

  // Calculate position with configurable offset
  const basePosition = useDerivedValue(() => {
    if(progressPercent == 0)
        return 0;
    const progress = Math.max(0, Math.min(1, animatedProgress.value));
    const offset = progressPercent < 0.1 ? 0.1 : offsetPercentage / 100; // Convert percentage to decimal
    return height * (1 - offset - progress);
  });

  // Create the wave path
  const path = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const centerY = basePosition.value;

    path.moveTo(0, centerY);

    for (let i = 0; i < width; i += 10) {
      const angle = (i / width) * Math.PI * 2 + clock.value / 500;
      const y = centerY + amplitude * Math.sin(angle);
      path.lineTo(i, y);
    }

    path.lineTo(width, height);
    path.lineTo(0, height);
    path.close();
    return path;
  });

  // Gradient positions
  const gradientStart = useDerivedValue(() =>
    vec(0, basePosition.value - amplitude)
  );
  const gradientEnd = useDerivedValue(() =>
    vec(0, basePosition.value + height * 0.5)
  );

  return (
    <Canvas style={{ position: "absolute", width, height }}>
      <Path path={path}>
        <LinearGradient
          start={gradientStart}
          end={gradientEnd}
          colors={colors}
        />
      </Path>
    </Canvas>
  );
};
