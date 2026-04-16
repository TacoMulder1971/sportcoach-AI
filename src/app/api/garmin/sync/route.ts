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

export async function POST(request: Request) {
  try {
    const email = process.env.GARMIN_EMAIL;
    const password = process.env.GARMIN_PASSWORD;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Garmin credentials niet geconfigureerd' },
        { status: 500 }
      );
    }

    // Parse existing activity IDs from request body
    let existingActivityIds: number[] = [];
    try {
      const body = await request.json();
      existingActivityIds = body.existingActivityIds || [];
    } catch {
      // No body or invalid JSON — treat as no existing IDs
    }

    const GC = new GarminConnect({ username: email, password });
    await GC.login();

    // Fetch activities (last 30)
    const rawActivities = await GC.getActivities(0, 30);
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
        startTime: a.startTimeLocal?.split(' ')[1]?.substring(0, 5) || undefined,
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
        avgPower: Math.round((a as unknown as Record<string, unknown>).avgPower as number || 0) || undefined,
        normalizedPower: Math.round((a as unknown as Record<string, unknown>).normPower as number || 0) || undefined,
        trainingStressScore: Math.round(((a as unknown as Record<string, unknown>).trainingStressScore as number || 0) * 10) / 10 || undefined,
      };
    });

    // Fetch HR zone details + splits voor nieuwe activiteiten (max 5, parallel)
    const newActivities = activities.filter(a => !existingActivityIds.includes(a.id));
    const toFetchDetails = newActivities.slice(0, 5);

    const gcGet = (GC as unknown as { get: <T = unknown>(url: string) => Promise<T> }).get.bind(GC);
    const API_BASE = 'https://connectapi.garmin.com';

    await Promise.all(toFetchDetails.map(async (activity) => {
      try {
        const [zonesResp, lapsResp] = await Promise.all([
          gcGet<Array<{ zoneNumber: number; secsInZone: number }>>(`${API_BASE}/activity-service/activity/${activity.id}/hrTimeInZones`).catch(() => null),
          gcGet<{ lapDTOs?: Array<Record<string, unknown>> }>(`${API_BASE}/activity-service/activity/${activity.id}/splits`).catch(() => null),
        ]);

        // HR zones
        if (zonesResp && Array.isArray(zonesResp)) {
          activity.hrZones = zonesResp
            .filter(z => (z.secsInZone || 0) > 0)
            .map(z => ({
              zone: `Z${z.zoneNumber}`,
              minutes: Math.round(z.secsInZone / 60),
            }));
        }

        // Splits/laps voor intervaltraining
        const laps = lapsResp?.lapDTOs;
        if (laps && Array.isArray(laps) && laps.length > 1) {
          activity.splits = laps.map(s => ({
            distance: Math.round(((Number(s.distance) || 0) / 1000) * 100) / 100,
            durationSeconds: Math.round(Number(s.duration) || 0),
            avgHR: Math.round(Number(s.averageHR) || 0),
            avgPower: Math.round(Number(s.averagePower) || 0) || undefined,
          }));
        }
      } catch (e) {
        console.error(`Failed to fetch details for activity ${activity.id}:`, e);
      }
    }));

    // Fetch sleep + health data + lactaatdrempel
    let health: GarminHealthStats | null = null;
    try {
      const [sleepData, steps, userSettings] = await Promise.all([
        GC.getSleepData(),
        GC.getSteps(),
        (GC as unknown as { getUserSettings: () => Promise<Record<string, unknown>> }).getUserSettings().catch(() => null),
      ]);
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());

      // Lactaatdrempel zit genest onder userData
      const userData = (userSettings?.userData as Record<string, unknown> | undefined);

      // Lactaatdrempel tempo omzetten naar min/km
      // Garmin geeft de waarde terug in een 0.1-m/s eenheid (bv. 0.32 = 3.2 m/s), dus ×10
      let lactateThresholdPace: string | undefined;
      const ltSpeedRaw = Number(userData?.lactateThresholdSpeed) || 0;
      const ltSpeed = ltSpeedRaw * 10;
      if (ltSpeed > 0) {
        const paceMin = 1000 / 60 / ltSpeed;
        const mins = Math.floor(paceMin);
        const secs = Math.round((paceMin - mins) * 60);
        lactateThresholdPace = `${mins}:${secs.toString().padStart(2, '0')}/km`;
      }

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
        avgRespirationRate: Math.round((sleepData as unknown as Record<string, number>)?.avgWakingRespirationValue || (sleepData as unknown as Record<string, number>)?.averageRespirationValue || 0) || undefined,
        lactateThresholdHR: Math.round(Number(userData?.lactateThresholdHeartRate) || 0) || undefined,
        lactateThresholdPace,
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
