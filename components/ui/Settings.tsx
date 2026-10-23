import React from 'react';
import { Pressable, StyleSheet, Text, View, type AccessibilityRole } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { decorative, a11yState } from '@/lib/accessibility';
import Card from './Card';

interface SettingsGroupProps {
  children: React.ReactNode;
  /** Use 'radiogroup' when the rows are mutually exclusive choices. */
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
}

/** Apple-style grouped list: rows inside one card, separated by hairlines. */
export function SettingsGroup({ children, accessibilityRole, accessibilityLabel }: SettingsGroupProps) {
  const { theme } = useThemeStore();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <Card
      radius={theme.borderRadius.md}
      style={styles.group}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      {rows.map((row, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <View
              style={[styles.divider, { backgroundColor: theme.colors.border }]}
              {...decorative}
            />
          )}
          {row}
        </React.Fragment>
      ))}
    </Card>
  );
}

type RowKind =
  | { kind: 'radio'; selected: boolean; onPress: () => void }
  | { kind: 'switch'; value: boolean; onValueChange: (v: boolean) => void }
  | { kind: 'button'; onPress: () => void; chevron?: boolean }
  | { kind: 'info' };

type SettingsRowProps = RowKind & {
  title: string;
  description?: string;
  /** Leading visual (icon, swatch). Hidden from screen readers. */
  left?: React.ReactNode;
  /** Trailing content for info rows (e.g. a button). */
  right?: React.ReactNode;
  /** Colors the title, e.g. theme.colors.error for destructive actions. */
  tone?: string;
  testID?: string;
};

/**
 * One settings row. The whole row is the control, so the touch target is the
 * full width, and screen readers hear e.g. "Friendly, radio button, checked".
 */
export function SettingsRow(props: SettingsRowProps) {
  const { theme } = useThemeStore();
  const { title, description, left, right, tone, testID } = props;

  const body = (
    <>
      {left ? (
        <View style={styles.left} {...decorative}>
          {left}
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={[styles.title, { color: tone ?? theme.colors.text }]}>{title}</Text>
        {description ? (
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            {description}
          </Text>
        ) : null}
      </View>
    </>
  );

  if (props.kind === 'info') {
    return (
      <View style={styles.row} testID={testID}>
        <View style={styles.infoBody} accessible accessibilityLabel={[title, description].filter(Boolean).join(', ')}>
          {body}
        </View>
        {right}
      </View>
    );
  }

  if (props.kind === 'switch') {
    const { value, onValueChange } = props;
    return (
      <Pressable
        testID={testID}
        accessibilityRole="switch"
        accessibilityLabel={title}
        accessibilityHint={description}
        {...a11yState({ checked: value })}
        onPress={() => onValueChange(!value)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {body}
        {/* Drawn, not a real <Switch>: the row is the one control. (On web a
            Switch is a focusable checkbox, which would nest a second control.) */}
        <View
          style={[
            styles.track,
            { backgroundColor: value ? theme.colors.accent : 'rgba(120,120,128,0.36)' },
          ]}
          {...decorative}
        >
          <View style={[styles.thumb, { alignSelf: value ? 'flex-end' : 'flex-start' }]} />
        </View>
      </Pressable>
    );
  }

  if (props.kind === 'radio') {
    const { selected, onPress } = props;
    return (
      <Pressable
        testID={testID}
        accessibilityRole="radio"
        accessibilityLabel={title}
        accessibilityHint={description}
        {...a11yState({ checked: selected })}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {body}
        <View
          style={[
            styles.radio,
            selected
              ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
              : { borderColor: theme.colors.textTertiary },
          ]}
          {...decorative}
        >
          {selected && <FontAwesome name="check" size={11} color={theme.colors.onPrimary} />}
        </View>
      </Pressable>
    );
  }

  const { onPress, chevron = true } = props;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
      {chevron && (
        <FontAwesome name="chevron-right" size={12} color={theme.colors.textTertiary} {...decorative} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  infoBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  left: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  track: {
    width: 51,
    height: 31,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
  },
  thumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
