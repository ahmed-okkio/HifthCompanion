import { queryClient } from '@/lib/query/Provider';
import { qk } from '@/lib/query/keys';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { isLocale, defaultLocale } from '@/lib/i18n/config';
import * as membership from '@/lib/services/membership';
import * as agenda from '@/lib/services/agenda';
import * as circle from '@/lib/services/circle';
import * as notes from '@/lib/services/membershipNotes';
import * as logs from '@/lib/services/progressLog';
import * as sessions from '@/lib/services/sessions';
import * as subs from '@/lib/services/substitution';
import * as homework from '@/lib/services/homework';
import * as exam from '@/lib/services/exam';

/**
 * Every tracker write goes through here (PRD 0016 E9/E10): refused up front when the browser
 * is offline (an error, never a silent loss), and the tracker queries are invalidated once it
 * settles so every screen and the rail refetch the new value. Components keep their own
 * optimistic local state on top.
 */
function tracked<A extends unknown[], R>(fn: (...a: A) => Promise<R>) {
  return async (...a: A): Promise<R> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const lang = document.documentElement.lang;
      throw new Error(getDictionary(isLocale(lang) ? lang : defaultLocale)['common.offlineWrite']);
    }
    try {
      return await fn(...a);
    } finally {
      void queryClient.invalidateQueries({ queryKey: qk.tracker });
    }
  };
}

export const acceptMembership = tracked(membership.acceptMembership);
export const leaveCircle = tracked(membership.leaveCircle);
export const inviteByEmail = tracked(membership.inviteByEmail);
export const setMembershipStatus = tracked(membership.setMembershipStatus);
export const addItem = tracked(agenda.addItem);
export const setDone = tracked(agenda.setDone);
export const updateBody = tracked(agenda.updateBody);
export const createCircle = tracked(circle.createCircle);
export const rotateInviteCode = tracked(circle.rotateInviteCode);
export const deleteCircle = tracked(circle.deleteCircle);
export const postNote = tracked(notes.postNote);
export const createLog = tracked(logs.createLog);
export const deleteLog = tracked(logs.deleteLog);
export const gradeLog = tracked(logs.gradeLog);
export const logAndReview = tracked(logs.logAndReview);
export const createAdhocSession = tracked(sessions.createAdhocSession);
export const materializeSession = tracked(sessions.materializeSession);
export const rescheduleSession = tracked(sessions.rescheduleSession);
export const setSchedule = tracked(sessions.setSchedule);
export const setSessionAttendance = tracked(sessions.setSessionAttendance);
export const setSessionCanceled = tracked(sessions.setSessionCanceled);
export const assignSubstitutes = tracked(subs.assignSubstitutes);
export const removeSubstitution = tracked(subs.removeSubstitution);
export const prescribeHomework = tracked(homework.prescribeHomework);
export const editDeadline = tracked(homework.editDeadline);
export const deleteHomework = tracked(homework.deleteHomework);
export const scheduleExam = tracked(exam.scheduleExam);
export const gradeExam = tracked(exam.gradeExam);
export const deleteExam = tracked(exam.deleteExam);
export const rescheduleExam = tracked(exam.rescheduleExam);
