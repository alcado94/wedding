export const MAX_COMPANIONS = 10;
export const NAME_MAX_LENGTH = 120;
export const DIETARY_MAX_LENGTH = 1000;

export interface Guest {
  fullName: string;
  dietary: string;
  needsBus: boolean;
}

export type RsvpResponse =
  | { attending: false; fullName: string }
  | { attending: true; guest: Guest; companions: Guest[] };

function requiredName(value: FormDataEntryValue | null): string {
  const name = String(value ?? '').trim();
  if (!name || name.length > NAME_MAX_LENGTH) throw new Error('Indica un nombre completo válido.');
  return name;
}

function readGuest(data: FormData, prefix: string): Guest {
  const dietary = String(data.get(`${prefix}-dietary`) ?? '').trim();
  const bus = data.get(`${prefix}-bus`);
  if (dietary.length > DIETARY_MAX_LENGTH) throw new Error('El texto del menú es demasiado largo.');
  if (bus !== 'yes' && bus !== 'no') throw new Error('Indica si necesitas utilizar el bus.');
  return {
    fullName: requiredName(data.get(`${prefix}-name`)),
    dietary,
    needsBus: bus === 'yes',
  };
}

export function buildResponse(data: FormData, companionIds: string[]): RsvpResponse {
  const fullName = requiredName(data.get('primary-name'));
  const attendance = data.get('attendance');
  if (attendance === 'no') return { attending: false, fullName };
  if (attendance !== 'yes') throw new Error('Indica si podrás asistir.');
  const accompanied = data.get('accompanied');
  if (accompanied !== 'yes' && accompanied !== 'no') throw new Error('Indica si vienes acompañado/a.');
  const activeIds = accompanied === 'yes' ? companionIds : [];
  if (accompanied === 'yes' && activeIds.length === 0) throw new Error('Añade al menos un acompañante.');
  if (activeIds.length > MAX_COMPANIONS || new Set(activeIds).size !== activeIds.length) {
    throw new Error(`Puedes añadir hasta ${MAX_COMPANIONS} acompañantes.`);
  }
  return { attending: true, guest: readGuest(data, 'primary'), companions: activeIds.map((id) => readGuest(data, id)) };
}
