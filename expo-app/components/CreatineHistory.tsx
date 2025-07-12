import { View, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import React, { useState, useEffect, useContext } from 'react';
import { Text } from '@/components/ui/text';
import { Box } from '@/components/ui/box';
import { CalendarDays, ChartPie, Flame } from 'lucide-react-native';
import { VStack } from '@/components/ui/vstack';
import HeatCalendar from '@/components/HeatCalendar';
import { supabase } from '@/lib/supabase';
import { Pie, PolarChart } from 'victory-native';
import { Divider } from '@/components/ui/divider';
import CreatineDay from '@/components/CreatineDay';
import { RefreshContext, RefreshContextType } from '@/context/refreshContext';
import {
	calculateSaturation,
	CreatineLogEntry,
	calculateDaysTillSaturated
} from '@/utils/creatineSaturation';

export type CommitData = {
	date: string;
	count: number;
	saturation?: number;
	taken?: boolean;
};

type DistributionData = {
	form: string;
	count: number;
	color: string;
};

export const getCommitDataForDate = (
	isoDate: string,
	commitData: CommitData[],
	fallback: CommitData = { date: '', count: 0, saturation: 0, taken: false }
): CommitData => {
	const targetDate = isoDate.split('T')[0];
	return commitData.find((entry) => entry.date === targetDate) || fallback;
};

export const CreatineHistory = () => {
	const [commitData, setCommitData] = useState<CommitData[]>([]);
	const [loading, setLoading] = useState(true);
	const [daysToShow] = useState(28); // You can make this configurable

	const [distributionData, setDistributionData] = useState<DistributionData[]>([]);

	const [consistencyData, setConsistencyData] = useState<any>(0);
	const [streakData, setStreakData] = useState<number>(0);
	const [daysLoggedData, setDaysLoggedData] = useState<number>(0);
	const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);
	const today = new Date().toISOString().split('T')[0]
		? new Date().toISOString().split('T')[0]
		: '2025-03-30';

	const { refresh, refreshTrigger } = useContext<RefreshContextType>(RefreshContext);

	useEffect(() => {
		const fetchCreatineData = async () => {
			try {
				const {
					data: { user }
				} = await supabase.auth.getUser();
				const { data } = await supabase
					.from('creatine_logs')
					.select('taken_at, dose_grams')
					.eq('user_id', user?.id)
					.order('taken_at', { ascending: true });

				// Aggregate daily doses
				const dailyDoses = new Map<string, number>();
				data?.forEach((log) => {
					const date = new Date(log.taken_at).toISOString().split('T')[0];
					const current = dailyDoses.get(date) || 0;
					dailyDoses.set(date, current + log.dose_grams);
				});

				// Generate complete timeline with doses
				const daysToShow = 28;
				const entries: CreatineLogEntry[] = [];
				for (let i = 0; i < daysToShow; i++) {
					const date = new Date();
					date.setDate(date.getDate() - i);
					const dateStr = date.toISOString().split('T')[0];
					entries.unshift({
						date: dateStr,
						doseGrams: dailyDoses.get(dateStr) || 0
					});
				}

				const saturations = calculateSaturation(entries);
				const turnIntoCount = (saturation: number) => {
					if (saturation == 0) return -1;
					return Math.floor(saturation * 6);
				};
				const heatmapData = entries.map((entry, i) => ({
					date: entry.date,
					count: turnIntoCount(saturations[i]), // Scale 0-1 to 0-4,
					saturation: saturations[i],
					taken: entries[i].doseGrams > 0
				}));
				console.log(heatmapData);

				setCommitData(heatmapData);
				console.log('Commit data set');
			} catch (error) {
				console.error('Error fetching creatine data:', error);
			}
		};

		const fetchCreatineForms = async () => {
			try {
				// Get current user
				const {
					data: { user },
					error: authError
				} = await supabase.auth.getUser();
				if (authError || !user) throw authError || new Error('No user logged in');

				// Call the Postgres function to get creatine forms data
				const { data, error } = await supabase.rpc('get_creatine_form_distribution', {
					user_uuid: user.id
				});

				if (error) throw error;
				// Add random colors to the data and set the distribution data
				const distribution: DistributionData[] = data.map((item: any) => {
					// Generate a random color for each type
					const color = generateRandomColor();
					return {
						form: item.form,
						count: item.count,
						color: color // Use the generated random color
					};
				});
				setDistributionData(distribution);
			} catch (error) {
				console.error('Error fetching creatine forms data:', error);
			}
		};

		const fetchCreatineConsistency = async () => {
			try {
				// Get current user
				const {
					data: { user },
					error: authError
				} = await supabase.auth.getUser();
				if (authError || !user) throw authError || new Error('No user logged in');

				// Call the Postgres function to get creatine consistency data
				const { data, error } = await supabase.rpc('get_creatine_consistency', {
					user_uuid: user.id
				});

				if (error) throw error;
				// Process the consistency data if needed
				setConsistencyData(data ? data[0].consistency_percentage : 0); // Assuming the response has a 'consistency' field
			} catch (error) {
				console.error('Error fetching creatine consistency data:', error);
			}
		};

		const fetchStreak = async () => {
			try {
				// Get current user
				const {
					data: { user },
					error: authError
				} = await supabase.auth.getUser();
				if (authError || !user) throw authError || new Error('No user logged in');

				// Call the Postgres function to get streak data
				const { data, error } = await supabase.rpc('get_creatine_streak', {
					user_uuid: user.id
				});

				if (error) throw error;
				// Process the streak data if needed
				setStreakData(data ? data[0].streak_days : 0); // Assuming the response has a 'streak_count' field
			} catch (error) {
				console.error('Error fetching creatine streak data:', error);
			}
		};

		const fetchDaysLogged = async () => {
			try {
				const {
					data: { user }
				} = await supabase.auth.getUser();
				const { data, error } = await supabase.rpc('get_creatine_days_logged', {
					user_uuid: user?.id
				});

				if (error) throw error;

				// Properly handle the array response
				const daysLogged = data?.[0]?.days_logged ?? 0;
				setDaysLoggedData(daysLogged);

				// This will log correctly
			} catch (error) {
				console.error('Error fetching days logged:', error);
				setDaysLoggedData(0);
			}
		};

		const fetchAllData = async () => {
			try {
				setLoading(true); // Ensure loading is true when starting

				// Run all fetches in parallel
				await Promise.all([
					fetchCreatineData(),
					fetchCreatineForms(),
					fetchCreatineConsistency(),
					fetchStreak(),
					fetchDaysLogged()
				]);
			} catch (error) {
				console.error('Error fetching data:', error);
			} finally {
				setLoading(false); // Only set loading to false when ALL data is loaded
			}
		};

		fetchAllData();
	}, [daysToShow, refreshTrigger.creatine]);

	function generateRandomColor(): string {
		// Generate random values for red and green channels between 0 and 127 (0x00 to 0x7F)
		const red = Math.floor(Math.random() * 0xbb); // 0x80 is 128, so result is [0, 127]
		const green = 0xee;
		const blue = Math.floor(Math.random() * 0xbb); // Blue is always at maximum

		// Convert each channel to a two-digit hexadecimal string
		const redHex = red.toString(16).padStart(2, '0');
		const greenHex = green.toString(16).padStart(2, '0');
		const blueHex = blue.toString(16).padStart(2, '0');

		return `#${redHex}${greenHex}${blueHex}`;
	}

	return (
		<View>
			{loading ? (
				<View className='py-8'>
					<ActivityIndicator size='large' color='#ffffff' />
				</View>
			) : (
				<VStack>
					<Box className='mt-4 bg-primary-0 rounded-[15px]'>
						<HeatCalendar
							data={commitData}
							endDate={new Date().toISOString().split('T')[0]}
							numDays={daysToShow}
							onDayPress={(date) => setSelectedDay(date)}
							colors={[
								'#335533',
								'#557755',
								'#779977',
								'#99BB99',
								'#BBDDBB',
								'#DDFFDD'
							].toReversed()}
						/>
						<CreatineDay
							day={selectedDay}
							dayData={getCommitDataForDate(selectedDay, commitData, {
								date: today,
								count: 0,
								saturation: 0,
								taken: false
							})}
						/>
					</Box>
					<View className='flex-row items-center pt-[20]'>
						<ChartPie color={'white'} size={32} />
						<Text className='text-[20px] font-semibold pl-[7]'>Metrics</Text>
					</View>
					<Box className='mt-4 bg-primary-0 rounded-[15px] p-4'>
						{distributionData.length > 0 ? (
							<View
								className='flex-row items-center justify-start'
								style={{ height: 150 }}>
								{/* Chart container with explicit dimensions */}
								<View className='w-3/5'>
									{/* Maintain square aspect ratio */}
									<PolarChart
										data={distributionData}
										labelKey='form'
										valueKey='count'
										colorKey='color'>
										<Pie.Chart innerRadius={'50%'} size={125} />
									</PolarChart>
								</View>

								{/* Legend - takes remaining space */}
								<View className='w-2/5 justify-center'>
									{distributionData.map((item, index) => (
										<View key={index} className='flex-row items-center mb-2'>
											<View
												className='w-3 h-3 rounded-full mr-2'
												style={{ backgroundColor: item.color }}
											/>
											<Text className='text-foreground text-sm'>
												<Text className='font-medium'>
													{item.form} ({item.count})
												</Text>
											</Text>
										</View>
									))}
								</View>
							</View>
						) : (
							<Text className='text-center py-8 text-foreground'>
								No creatine form data available
							</Text>
						)}
					</Box>

					<Box className='bg-primary-0 rounded-[15px] p-6 mt-4'>
						<View className='flex-row items-center justify-between'>
							{/* First Consistency */}
							<View className='flex-1 items-center'>
								<Text className='text-sm mb-1'>Consistency</Text>
								<Text className='text-xl font-bold'>
									{consistencyData ? `${consistencyData}%` : '0%'}
								</Text>
							</View>

							<Divider orientation='vertical' />

							{/* Streak - Centered with icon and number */}
							<View className='flex-1 items-center'>
								<Text className='text-sm mb-1'>Streak</Text>
								<View className='flex-row items-center justify-center'>
									<Flame color='white' size={18} className='mr-1' />
									<Text className='text-xl font-bold'>{streakData ?? 0}</Text>
								</View>
							</View>

							<Divider orientation='vertical' />

							{/* Second Metric - Replace with something different */}
							<View className='flex-1 items-center'>
								<Text className='text-sm mb-1'>Days Logged</Text>
								<Text className='text-xl font-bold'>{daysLoggedData}</Text>
							</View>
						</View>
					</Box>

					<Box className='bg-primary-0 rounded-[15px] p-6 mt-4'>
						<View className='flex-row items-center justify-between'>
							{/* First Consistency */}
							<View className='flex-1 items-center'>
								<Text className='text-md mb-1'>Saturation</Text>
								<Text className='text-2xl font-bold'>
									{Math.floor(
										(getCommitDataForDate(today, commitData, {
											date: today,
											count: 0,
											saturation: 0,
											taken: false
										})?.saturation ?? 0) * 100
									)}
									%
								</Text>
							</View>

							<Divider orientation='vertical' />

							{/* Streak - Centered with icon and number */}
							<View className='flex-1 items-center'>
								<Text className='text-md mb-1'>Till Saturation</Text>
								<Text className='text-2xl font-bold'>
									{calculateDaysTillSaturated(
										getCommitDataForDate(today, commitData, {
											date: today,
											count: 0,
											saturation: 0,
											taken: false
										})?.saturation ?? 0,
										5
									)}
									days
								</Text>
							</View>
						</View>
					</Box>
				</VStack>
			)}
		</View>
	);
};
