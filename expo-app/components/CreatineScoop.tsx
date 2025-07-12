import { Svg, Path, Line } from 'react-native-svg';

// Add this component definition (can be in same file or separate component file)
const CreatineScoopIcon = ({ color = 'white', size = 32 }) => (
	<Svg
		width={size}
		height={size}
		viewBox='0 0 32 32'
		fill='none'
		stroke={color}
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'>
		<Path d='M6 13 L18 13 L17 21 L7 21 Z' />
		<Line x1='16' y1='13' x2='26' y2='13' />
	</Svg>
);

export default CreatineScoopIcon;
