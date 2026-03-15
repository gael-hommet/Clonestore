import { PierreDocType } from "./docTypes";

export const requiredFieldsByDocType = {
  [PierreDocType.CANDIDATE_EMAIL_REJECTION]: [
    "candidate_name",
    "job_title"
  ],
  [PierreDocType.CANDIDATE_EMAIL_INVITE]: [
    "candidate_name",
    "job_title",
    "interview_date",
    "interview_time",
    "interview_location"
  ],
  [PierreDocType.CANDIDATE_EMAIL_FOLLOWUP]: [
    "candidate_name",
    "job_title"
  ],
  [PierreDocType.CANDIDATE_EMAIL_ONBOARDING]: [
    "candidate_name",
    "job_title",
    "start_date"
  ],
};