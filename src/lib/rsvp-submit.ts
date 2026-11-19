import type { RsvpResponse } from './rsvp';

export const RSVP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw8P1AqcHvy-i0Ns517DmJKYvARE6V9ym7G66VA8arBuIz--sc9vqa_deCad_oC0J8pmA/exec';

export interface Submission {
  submissionId: string;
  response: RsvpResponse;
}

export async function submitResponse(submission: Submission): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const result = await fetch(RSVP_ENDPOINT, {
      method: 'POST',
      // A simple cross-origin request avoids an unsupported OPTIONS preflight.
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(submission),
      credentials: 'omit',
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!result.ok) throw new Error('El servicio no está disponible.');
    const confirmation = await result.json();
    if (confirmation?.ok !== true || confirmation.submissionId !== submission.submissionId) {
      throw new Error('No se ha recibido una confirmación válida.');
    }
  } finally {
    clearTimeout(timeout);
  }
}
