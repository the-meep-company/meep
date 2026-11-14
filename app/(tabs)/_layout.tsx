import React from 'react';
import { Platform } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import FloatingTabBar from '@/components/navigation/FloatingTabBar';
import WebSidebar from '@/components/navigation/WebSidebar';
import { useWideLayout } from '@/lib/layout';
import { useThemeStore } from '@/stores/themeStore';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  size?: number;
}) {
  return <FontAwesome size={props.size ?? 22} name={props.name} color={props.color} />;
}

/**
 * iOS: the system tab bar (UITabBarController). On iOS 26+ it's Apple's own
 * Liquid Glass bar — lensing selection, shrinks while scrolling down.
 */
function NativeTabLayout() {
  const { theme } = useThemeStore();
  return (
    <NativeTabs tintColor={theme.colors.tabBarActive} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="calendar">
        <Icon sf="calendar" />
        <Label>Calendar</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tasks">
        <Icon sf={{ default: 'checkmark.circle', selected: 'checkmark.circle.fill' }} />
        <Label>Tasks</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <Icon sf="wand.and.sparkles" />
        <Label>Meep</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

export default function TabLayout() {
  const wide = useWideLayout();
  if (Platform.OS === 'ios') return <NativeTabLayout />;

  return (
    <Tabs
      // Desktop web: a left sidebar. Otherwise a floating Liquid Glass pill that
      // overlays the screens so content scrolls under it.
      tabBar={(props) => (wide ? <WebSidebar {...props} /> : <FloatingTabBar {...props} />)}
      screenOptions={{ headerShown: false, tabBarPosition: wide ? 'left' : 'bottom' }}
    >
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => <TabBarIcon name="calendar" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => <TabBarIcon name="check-circle" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Meep',
          tabBarIcon: ({ color, size }) => <TabBarIcon name="magic" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <TabBarIcon name="cog" color={color} size={size} />,
        }}
      />
      {/* Hide old template screens */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}
