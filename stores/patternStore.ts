import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PatternDataPoint, SchedulingPattern } from '@/types';

interface PatternState {
  dataPoints: PatternDataPoint[];
  patterns: SchedulingPattern[];
  pointsSinceLastCompute: number;

  // Actions
  recordDataPoint: (point: Omit<PatternDataPoint, 'id' | 'recordedAt'>) => void;
  recomputePatterns: () => void;

  // Selectors
  getPatternForCategory: (category?: string) => SchedulingPattern | undefined;
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 7);
}

export const usePatternStore = create<PatternState>()(
  persist(
    (set, get) => ({
      dataPoints: [],
      patterns: [],
      pointsSinceLastCompute: 0,

      recordDataPoint: (point) => {
        const newPoint: PatternDataPoint = {
          ...point,
          id: generateId(),
          recordedAt: new Date(),
        };

        set((state) => {
          const updated = [...state.dataPoints, newPoint].slice(-200);
          const newCount = state.pointsSinceLastCompute + 1;
          return { dataPoints: updated, pointsSinceLastCompute: newCount };
        });

        // Auto-recompute after every 5 data points
        if (get().pointsSinceLastCompute >= 5) {
          get().recomputePatterns();
        }
      },

      recomputePatterns: () => {
        const { dataPoints } = get();
        if (dataPoints.length === 0) return;

        // Group by category (undefined → '__general__')
        const groups = new Map<string, PatternDataPoint[]>();
        for (const dp of dataPoints) {
          const key = dp.category ?? '__general__';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(dp);
        }

        const patterns: SchedulingPattern[] = [];
        for (const [key, points] of groups) {
          // Weighted average: recent entries get higher weight
          let totalWeight = 0;
          let weightedStartHour = 0;
          let weightedEndHour = 0;
          let weightedDuration = 0;
          const dayCounts = new Map<number, number>();

          for (let i = 0; i < points.length; i++) {
            const weight = 1.0 + i / points.length;
            totalWeight += weight;
            weightedStartHour += points[i].startHour * weight;
            weightedEndHour += points[i].endHour * weight;
            weightedDuration += points[i].durationMinutes * weight;

            const day = points[i].dayOfWeek;
            dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
          }

          // Days that appear in >25% of data points for this category
          const threshold = points.length * 0.25;
          const preferredDays = Array.from(dayCounts.entries())
            .filter(([, count]) => count >= threshold)
            .map(([day]) => day)
            .sort();

          patterns.push({
            id: key,
            category: key === '__general__' ? undefined : key,
            preferredTimeRange: {
              startHour: Math.round((weightedStartHour / totalWeight) * 2) / 2, // round to nearest 0.5
              endHour: Math.round((weightedEndHour / totalWeight) * 2) / 2,
            },
            preferredDays,
            avgDurationMinutes: Math.round(weightedDuration / totalWeight),
            sampleSize: points.length,
            updatedAt: new Date(),
          });
        }

        set({ patterns, pointsSinceLastCompute: 0 });
      },

      getPatternForCategory: (category) => {
        const { patterns } = get();
        return patterns.find((p) => p.category === category) ?? patterns.find((p) => !p.category);
      },
    }),
    {
      name: 'meep-patterns',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        dataPoints: state.dataPoints,
        patterns: state.patterns,
      }),
    }
  )
);
