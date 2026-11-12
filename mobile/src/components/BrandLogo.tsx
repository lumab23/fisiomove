import { Circle, Path, Svg } from 'react-native-svg';

import { LOGO } from '../assets/brand/logoData';
import { colors } from '../theme/theme';

interface BrandLogoProps {
  height?: number;
}

/** Official FisioMove horizontal wordmark, drawn from the supplied design system. */
export function BrandLogo({ height = 28 }: BrandLogoProps) {
  const viewBox = LOGO.viewBox.horizontal;
  const width = (viewBox.w / viewBox.h) * height;

  return (
    <Svg
      accessible
      accessibilityRole="image"
      accessibilityLabel="FisioMove"
      height={height}
      width={width}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
    >
      <Path
        d={LOGO.symbolPath}
        fill="none"
        stroke={colors.primary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={LOGO.strokeWidth}
      />
      <Circle
        cx={LOGO.dot.cx}
        cy={LOGO.dot.cy}
        r={LOGO.dot.r}
        fill={colors.brandAccent}
      />
      <Path d={LOGO.wordmarkPath} fill={colors.primary} />
    </Svg>
  );
}
