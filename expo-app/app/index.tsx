import { Spinner, Text, YStack } from 'tamagui';
export default function Index() {
  return <YStack flex={1} backgroundColor="#0c0c0c" alignItems="center" justifyContent="center" gap={20}>
    <Text fontFamily="$body" fontWeight="800" fontSize={28} color="#e9e9e9">DROPS.</Text>
    <Spinner color="#398eff" aria-label="Loading your account" />
  </YStack>;
}
