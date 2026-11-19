import { buildResponse, MAX_COMPANIONS, type Guest, type RsvpResponse } from '../lib/rsvp';

const form = document.querySelector<HTMLFormElement>('[data-rsvp-form]');

if (form) {
  const section = form.closest<HTMLElement>('.rsvp-section')!;
  const attending = form.querySelector<HTMLFieldSetElement>('[data-attending]')!;
  const companionsSection = form.querySelector<HTMLFieldSetElement>('[data-companions-section]')!;
  const companions = form.querySelector<HTMLElement>('[data-companions]')!;
  const template = section.querySelector<HTMLTemplateElement>('[data-companion-template]')!;
  const addButton = form.querySelector<HTMLButtonElement>('[data-add]')!;
  const counter = form.querySelector<HTMLElement>('[data-counter]')!;
  const announcement = section.querySelector<HTMLElement>('[data-announcement]')!;
  const formError = form.querySelector<HTMLElement>('[data-form-error]')!;
  const summary = section.querySelector<HTMLElement>('[data-summary]')!;
  const reviewButton = form.querySelector<HTMLButtonElement>('[data-review]')!;
  let nextId = 0;

  const cards = () => [...companions.querySelectorAll<HTMLFieldSetElement>('[data-guest]')];
  const selected = (name: string) => form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;

  function announce(message: string) {
    announcement.textContent = message;
  }

  function updateCompanions() {
    const guests = cards();
    guests.forEach((card, index) => {
      card.querySelector('[data-guest-title]')!.textContent = `Acompañante ${index + 1}`;
      card.querySelector('[data-remove]')!.setAttribute('aria-label', `Eliminar acompañante ${index + 1}`);
    });
    counter.textContent = `${guests.length} de ${MAX_COMPANIONS} acompañantes`;
    addButton.disabled = guests.length >= MAX_COMPANIONS;
  }

  function addCompanion(focus: boolean) {
    if (cards().length >= MAX_COMPANIONS) return;
    const id = `companion-${++nextId}`;
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    const card = fragment.querySelector<HTMLFieldSetElement>('[data-guest]')!;
    card.dataset.guest = id;
    fragment.querySelectorAll<HTMLElement>('*').forEach((element) => {
      for (const attribute of ['id', 'name', 'for', 'aria-describedby']) {
        const value = element.getAttribute(attribute);
        if (value) element.setAttribute(attribute, value.replaceAll('companion-template', id));
      }
    });
    companions.append(fragment);
    updateCompanions();
    if (focus) card.querySelector<HTMLInputElement>('[data-full-name]')!.focus();
    announce(`Acompañante añadido. ${cards().length} de ${MAX_COMPANIONS}.${addButton.disabled ? ' Has alcanzado el máximo de acompañantes.' : ''}`);
  }

  function setActive(fieldset: HTMLFieldSetElement, active: boolean) {
    fieldset.hidden = !active;
    fieldset.disabled = !active;
  }

  function syncConditionalFields() {
    const isAttending = selected('attendance') === 'yes';
    const isAccompanied = isAttending && selected('accompanied') === 'yes';
    setActive(attending, isAttending);
    setActive(companionsSection, isAccompanied);
    if (isAccompanied && cards().length === 0) addCompanion(false);
  }

  type Control = HTMLInputElement | HTMLTextAreaElement;

  function validate(control: Control, showError: boolean) {
    control.setCustomValidity('');
    if (control.matches('[data-full-name]') && !control.value.trim()) {
      control.setCustomValidity('Escribe el nombre completo, sin dejarlo en blanco.');
    }
    const valid = control.validity.valid;
    const wrapper = control.closest<HTMLElement>(control.type === 'radio' ? '[data-choice]' : '.field');
    const error = wrapper?.querySelector<HTMLElement>('[data-error]');
    if (!error) return valid;
    if (showError || valid) {
      let message = control.validationMessage;
      if (control.type === 'radio' && !valid) message = 'Selecciona una de las opciones.';
      else if (control.validity.valueMissing) message = 'Completa este campo.';
      error.textContent = valid ? '' : message;
      error.hidden = valid;
      const controls = control.type === 'radio' ? wrapper!.querySelectorAll('input') : [control];
      controls.forEach((input) => {
        if (valid) input.removeAttribute('aria-invalid');
        else input.setAttribute('aria-invalid', 'true');
      });
    }
    return valid;
  }

  form.addEventListener('change', () => {
    syncConditionalFields();
    formError.hidden = true;
  });
  form.addEventListener('input', (event) => {
    const control = event.target;
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
      validate(control, control.getAttribute('aria-invalid') === 'true');
    }
  });
  addButton.addEventListener('click', () => addCompanion(true));
  companions.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('[data-remove]');
    const card = button?.closest<HTMLFieldSetElement>('[data-guest]');
    if (!card) return;
    const guests = cards();
    const index = guests.indexOf(card);
    card.remove();
    updateCompanions();
    if (cards().length === 0) {
      const noCompanions = form.querySelector<HTMLInputElement>('input[name="accompanied"][value="no"]')!;
      noCompanions.checked = true;
      syncConditionalFields();
      noCompanions.focus();
    } else {
      const nearby = cards()[Math.min(index, cards().length - 1)];
      nearby.querySelector<HTMLInputElement>('[data-full-name]')!.focus();
    }
    announce(`Acompañante eliminado. ${cards().length} de ${MAX_COMPANIONS}.`);
  });

  function renderGuest(guest: Guest, title: string, prefix: string) {
    const article = document.createElement('article');
    article.className = 'summary-guest';
    const heading = document.createElement('h3');
    heading.textContent = `${title}: ${guest.fullName}`;
    const dietary = document.createElement('p');
    dietary.textContent = `Intolerancias o menú especial: ${guest.dietary || 'Sin indicaciones'}`;
    const bus = document.createElement('p');
    bus.textContent = `Bus: ${guest.needsBus ? 'Sí' : 'No'}`;
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'summary-edit';
    editButton.dataset.editPerson = `${prefix}-name`;
    editButton.textContent = 'Editar datos';
    editButton.setAttribute('aria-label', `Editar datos de ${guest.fullName} (${title})`);
    article.append(heading, dietary, bus, editButton);
    return article;
  }

  function showSummary(response: RsvpResponse) {
    const intro = summary.querySelector<HTMLElement>('[data-summary-intro]')!;
    const guestList = summary.querySelector<HTMLElement>('[data-summary-guests]')!;
    guestList.replaceChildren();
    if (response.attending) {
      const total = response.companions.length + 1;
      intro.textContent = `Asistencia confirmada para esta vista previa: ${total} ${total === 1 ? 'persona' : 'personas'}.`;
      guestList.append(renderGuest(response.guest, 'Tus datos', 'primary'));
      const companionCards = cards();
      response.companions.forEach((guest, index) => {
        guestList.append(renderGuest(guest, `Acompañante ${index + 1}`, companionCards[index].dataset.guest!));
      });
    } else {
      intro.textContent = `${response.fullName}, has indicado que no podrás asistir. Gracias por avisarnos.`;
    }
    form!.hidden = true;
    summary.hidden = false;
    summary.focus();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    formError.hidden = true;
    const controls = [...form.querySelectorAll<Control>('input, textarea')].filter((control) => !control.matches(':disabled'));
    const invalid = controls.filter((control) => !validate(control, true));
    if (invalid.length) {
      formError.textContent = 'Revisa los campos indicados antes de continuar.';
      formError.hidden = false;
      invalid[0].focus();
      return;
    }
    try {
      showSummary(buildResponse(new FormData(form), cards().map((card) => card.dataset.guest!)));
    } catch (error) {
      formError.textContent = error instanceof Error ? error.message : 'No se ha podido preparar el resumen. Revisa los datos.';
      formError.hidden = false;
    }
  });

  function editResponse(targetId = 'primary-name') {
    summary.hidden = true;
    form!.hidden = false;
    const target = document.getElementById(targetId);
    if (target instanceof HTMLInputElement && form!.contains(target)) target.focus();
  }

  section.querySelector('[data-edit]')!.addEventListener('click', () => editResponse());
  summary.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('[data-edit-person]');
    if (button) editResponse(button.dataset.editPerson);
  });

  // Enable the interactive flow only after handlers are ready.
  form.noValidate = true;
  reviewButton.disabled = false;
  syncConditionalFields();
}
