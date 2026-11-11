import React from 'react';
import { View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { GlowFill } from '@/components/ui/Card';
import { decorative } from '@/lib/accessibility';
import type { Meeple } from '@/types';

type FAName = React.ComponentProps<typeof FontAwesome>['name'];

/** A meeple's face: its icon on a grainy glow. */
export default function MeepleAvatar({
  icon,
  glow,
  size = 48,
}: Pick<Meeple, 'icon' | 'glow'> & { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      {...decorative}
    >
      <GlowFill name={glow} radius={size / 2} />
      <FontAwesome name={icon as FAName} size={Math.round(size * 0.42)} color="#FFFFFF" />
    </View>
  );
}
