'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { TabBar } from './ui';
import type { Halaqah, MemberWithProfile, ProgressLog, Session, Attendance } from '@/types';
import TeacherHalaqah from './TeacherHalaqah';
import TeacherSessions from './TeacherSessions';
import ActiveSession from './ActiveSession';

export default function TeacherHalaqahTabs({
  halaqah,
  teacher,
  members,
  initialFeed,
  sessions,
  students,
  attendance,
}: {
  halaqah: Halaqah;
  teacher?: MemberWithProfile;
  members: MemberWithProfile[];
  initialFeed: ProgressLog[];
  sessions: Session[];
  students: MemberWithProfile[];
  attendance: Attendance[];
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState('progress');
  // Lifted so the Sessions and Active tabs share one source of truth.
  const [sessionRows, setSessionRows] = useState(sessions);
  const [attendanceRows, setAttendanceRows] = useState(attendance);

  const tabs = [
    { key: 'progress', label: t('tracker.tabProgress') },
    { key: 'active', label: t('tracker.tabActive') },
    { key: 'sessions', label: t('tracker.tabSessions') },
  ];

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0" style={{ overflow: 'hidden' }}>
      <TabBar tabs={tabs} active={tab} onSelect={setTab} />
      {tab === 'progress' && (
        <div className="flex-1" style={{ overflowY: 'auto' }}>
          <TeacherHalaqah halaqah={halaqah} teacher={teacher} initialMembers={members} initialFeed={initialFeed} />
        </div>
      )}
      {tab === 'active' && (
        <ActiveSession
          halaqah={halaqah}
          students={students}
          sessions={sessionRows}
          setSessions={setSessionRows}
          attendance={attendanceRows}
          setAttendance={setAttendanceRows}
        />
      )}
      {tab === 'sessions' && (
        <TeacherSessions halaqah={halaqah} sessions={sessionRows} setSessions={setSessionRows} />
      )}
    </div>
  );
}
