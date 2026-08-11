import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TowerSnapshot, TowerStatus } from '@/features/timberline/tower-world';

const STATUS_COLOR: Record<TowerStatus, string> = {
  collapsed: '#ff6647',
  critical: '#ff7352',
  stable: '#6ee7a6',
  wobbling: '#ffc76f',
};

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export const TowerHud = memo(function TowerHud({
  bottom,
  compact,
  onBack,
  onNudge,
  onToggleSound,
  snapshot,
  soundEnabled,
  top,
}: {
  bottom: number;
  compact: boolean;
  onBack: () => void;
  onNudge: () => void;
  onToggleSound: () => void;
  snapshot: TowerSnapshot;
  soundEnabled: boolean;
  top: number;
}) {
  const color = STATUS_COLOR[snapshot.status];
  return (
    <>
      <View pointerEvents="box-none" style={[styles.topArea, { paddingTop: top }]}>
        <View style={styles.navigationRow}>
          <Pressable
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={onBack}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.titlePill}>
            <View style={[styles.statusDot, { backgroundColor: color }]} />
            <Text style={styles.title}>TIMBERLINE</Text>
            <Text style={[styles.status, { color }]}>{snapshot.status.toUpperCase()}</Text>
          </View>
          <Pressable
            accessibilityLabel={soundEnabled ? 'Turn sound off' : 'Turn sound on'}
            hitSlop={10}
            onPress={onToggleSound}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Text style={styles.soundIcon}>{soundEnabled ? '♪' : '–'}</Text>
          </Pressable>
        </View>

        <View pointerEvents="none" style={[styles.dataPill, compact && styles.dataPillCompact]}>
          <Metric label="STANDING" value={snapshot.standing} />
          <View style={styles.separator} />
          <Metric label="FALLEN" value={snapshot.fallen} />
          <View style={styles.separator} />
          <Metric label="SCORE" value={snapshot.score.toLocaleString()} />
          <View style={styles.stabilityMetric}>
            <View style={styles.stabilityHeader}>
              <Text style={styles.metricLabel}>BALANCE</Text>
              <Text style={[styles.stabilityValue, { color }]}>{snapshot.stability}%</Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { backgroundColor: color, width: `${snapshot.stability}%` },
                ]}
              />
            </View>
          </View>
        </View>
      </View>

      <View pointerEvents="box-none" style={[styles.bottomArea, { paddingBottom: bottom }]}>
        <View pointerEvents="none" style={styles.hintPill}>
          <Text style={styles.hint}>TAP BLOCK · DRAG ORBIT · PINCH ZOOM</Text>
        </View>
        <Pressable
          accessibilityLabel="Nudge tower"
          onPress={onNudge}
          style={({ pressed }) => [styles.nudge, pressed && styles.nudgePressed]}>
          <Text style={styles.nudgeLabel}>NUDGE</Text>
        </Pressable>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  topArea: {
    left: 0,
    paddingHorizontal: 14,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 3,
  },
  navigationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,9,8,.7)',
    borderColor: 'rgba(255,255,255,.12)',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  pressed: { opacity: 0.55 },
  backIcon: { color: '#fff', fontSize: 28, fontWeight: '600', marginTop: -3 },
  soundIcon: { color: '#fff', fontSize: 17, fontWeight: '700' },
  titlePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,9,8,.72)',
    borderColor: 'rgba(255,255,255,.1)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  statusDot: { borderRadius: 4, height: 7, width: 7 },
  title: { color: 'rgba(255,255,255,.76)', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  status: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  dataPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(10,9,8,.72)',
    borderColor: 'rgba(255,255,255,.1)',
    borderCurve: 'continuous',
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 9,
    maxWidth: 560,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
  },
  dataPillCompact: { gap: 7, paddingHorizontal: 10, paddingVertical: 8 },
  metric: { minWidth: 44 },
  metricLabel: { color: 'rgba(255,255,255,.36)', fontSize: 7, fontWeight: '800', letterSpacing: 1 },
  metricValue: { color: '#fff', fontSize: 17, fontVariant: ['tabular-nums'], fontWeight: '800', marginTop: 1 },
  separator: { backgroundColor: 'rgba(255,255,255,.1)', height: 26, width: StyleSheet.hairlineWidth },
  stabilityMetric: { flex: 1, gap: 5, minWidth: 72 },
  stabilityHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  stabilityValue: { fontSize: 9, fontVariant: ['tabular-nums'], fontWeight: '900' },
  track: { backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 2, height: 3, overflow: 'hidden' },
  fill: { borderRadius: 2, height: 3 },
  bottomArea: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: 14,
    position: 'absolute',
    right: 0,
    zIndex: 3,
  },
  hintPill: {
    backgroundColor: 'rgba(10,9,8,.62)',
    borderColor: 'rgba(255,255,255,.09)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  hint: { color: 'rgba(255,255,255,.5)', fontSize: 7, fontWeight: '800', letterSpacing: 0.7 },
  nudge: {
    backgroundColor: 'rgba(84,46,24,.88)',
    borderColor: 'rgba(255,195,117,.4)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 76,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  nudgePressed: { backgroundColor: 'rgba(120,65,31,.92)', opacity: 0.75 },
  nudgeLabel: { color: '#ffd092', fontSize: 9, fontWeight: '900', letterSpacing: 1.4, textAlign: 'center' },
});
