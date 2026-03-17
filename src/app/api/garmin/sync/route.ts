import { NextResponse } from 'next/server';
import { GarminConnect } from 'garmin-connect';
import { GarminActivity, GarminHealthStats, GarminSyncData, Sport } from '@/lib/types';

function mapGarminSport(typeKey: string): Sport | 'overig' {
  const map: Record<string, Sport> = {
    running: 'hardlopen',
    street_running: 'hardlopen',
    trail_running: 'hardlopen',
    track_running: 'hardlopen',
    treadmill_running: 'hardlopen',
    cycling: 'fietsen',
    road_biking: 'fietsen',
    indoor_cycling: 'fietsen',
    mountain_biking: 'mountainbike',
    gravel_cycling: 'fietsen',
    lap_swimming: 'zwemmen',
    open_water_swimming: 'zwemmen',
    pool_swimming: 'zwemmen',
    swimming: 'zwemmen',
  };
  return map[typeKey] || 'overig';
}

export async function POST() {
  try {
    const email = process.env.GARMIN_EMAIL;
    const password = process.env.GARMIN_PASSWORD;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Garmin credentials niet geconfigureerd' },
        { status: 500 }
      );
    }

    const GC = new GarminConnect({ username: email, password });
    await GC.login();

    // Fetch activities (last 10)
    const rawActivities = await GC.getActivities(0, 10);
    const activities: GarminActivity[] = rawActivities.map((a) => {
      const sport = mapGarminSport(a.activityType?.typeKey || '');
      const durationMinutes = Math.round((a.duration || 0) / 60);
      const distanceKm = Math.round(((a.distance || 0) / 1000) * 100) / 100;
      const avgSpeedKmh = Math.round(((a.averageSpeed || 0) * 3.6) * 10) / 10;

      // Bereken pace
      let avgPace = '';
      if (distanceKm > 0 && durationMinutes > 0) {
        if (sport === 'hardlopen') {
          const paceMin = durationMinutes / distanceKm;
          const mins = Math.floor(paceMin);
          const secs = Math.round((paceMin - mins) * 60);
          avgPace = `${mins}:${secs.toString().padStart(2, '0')}/km`;
        } else if (sport === 'zwemmen') {
          const pacePer100 = (durationMinutes * 60) / (distanceKm * 10); // sec per 100m
          const mins = Math.floor(pacePer100 / 60);
          const secs = Math.round(pacePer100 % 60);
          avgPace = `${mins}:${secs.toString().padStart(2, '0')}/100m`;
        } else {
          avgPace = `${avgSpeedKmh} km/h`;
        }
      }

      return {
        id: a.activityId,
        date: a.startTimeLocal?.split(' ')[0] || '',
        sport,
        activityName: a.activityName || '',
        durationMinutes,
        distanceKm,
        avgHR: Math.round(a.averageHR || 0),
        maxHR: Math.round(a.maxHR || 0),
        calories: Math.round(a.calories || 0),
        avgSpeed: avgSpeedKmh,
        trainingEffectAerobic: Math.round(((a as unknown as Record<string, unknown>).aerobicTrainingEffect as number || 0) * 10) / 10,
        trainingEffectAnaerobic: Math.round(((a as unknown as Record<string, unknown>).anaerobicTrainingEffect as number || 0) * 10) / 10,
        avgRunCadence: Math.round(((a as unknown as Record<string, unknown>).averageRunningCadenceInStepsPerMinute as number || 0)),
        avgBikeCadence: Math.round(((a as unknown as Record<string, unknown>).averageBikingCadenceInRevPerMinute as number || 0)),
        elevationGain: Math.round(((a as unknown as Record<string, unknown>).elevationGain as number || 0)),
        elevationLoss: Math.round(((a as unknown as Record<string, unknown>).elevationLoss as number || 0)),
        vo2Max: Math.round(((a as unknown as Record<string, unknown>).vO2MaxValue as number || 0)),
        avgPace,
      };
    });

    // Fetch sleep + health data
    let health: GarminHealthStats | null = null;
    try {
      const sleepData = await GC.getSleepData();
      const steps = await GC.getSteps();
      const today = new Date().toISOString().split('T')[0];

      health = {
        date: today,
        sleepDurationHours: Math.round(((sleepData?.dailySleepDTO?.sleepTimeSeconds || 0) / 3600) * 10) / 10,
        sleepScore: sleepData?.dailySleepDTO?.sleepScores?.overall?.value || 0,
        deepSleepMinutes: Math.round((sleepData?.dailySleepDTO?.deepSleepSeconds || 0) / 60),
        remSleepMinutes: Math.round((sleepData?.dailySleepDTO?.remSleepSeconds || 0) / 60),
        avgOvernightHrv: Math.round(sleepData?.avgOvernightHrv || 0),
        hrvStatus: sleepData?.hrvStatus || 'onbekend',
        restingHR: Math.round(sleepData?.restingHeartRate || 0),
        bodyBatteryChange: sleepData?.bodyBatteryChange || 0,
        steps: steps || 0,
      };
    } catch (e) {
      console.error('Garmin health data error:', e);
    }

    const syncData: GarminSyncData = {
      activities,
      health,
      syncedAt: new Date().toISOString(),
    };

    return NextResponse.json(syncData);
  } catch (error) {
    console.error('Garmin sync error:', error);
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    return NextResponse.json(
      { error: `Garmin sync mislukt: ${message}` },
      { status: 500 }
    );
  }
}
