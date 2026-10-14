import { router } from 'expo-router';
import { GroupSetup } from '@/components/GroupSetup';
import { Screen } from '@/components/ui';

export default function GroupAddScreen() {
  return (
    <Screen edges={[]}>
      <GroupSetup onDone={() => router.back()} />
    </Screen>
  );
}
