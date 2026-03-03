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
    const activities: GarminActivity[] = rawActivities.map((a) => ({
      id: a.activityId,
      date: a.startTimeLocal?.split(' ')[0] || '',
      sport: mapGarminSport(a.activityType?.typeKey || ''),
      activityName: a.activityName || '',
      durationMinutes: Math.round((a.duration || 0) / 60),
      distanceKm: Math.round(((a.distance || 0) / 1000) * 100) / 100,
      avgHR: Math.round(a.averageHR || 0),
      maxHR: Math.round(a.maxHR || 0),
      calories: Math.round(a.calories || 0),
      avgSpeed: Math.round(((a.averageSpeed || 0) * 3.6) * 10) / 10,
    }));

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
