// Mock RAM de l'espace membre pour les tests E2E (PW_TEST=1).
// Même philosophie que firestore-mock.js : aucune requête réseau vers le
// Worker eglise-app, état réinitialisable via POST /api/reset-mock.
// Sélection de l'utilisateur via la convention 'mock-test-token:email'.

// Dates ancrées sur le MOIS COURANT plutôt que figées dans le calendrier.
// La vue cartes de /agenda ne montre que les événements du mois affiché : une
// date en dur finit fatalement par sortir de cette fenêtre, et les tests qui
// en dépendent se mettent à échouer sans qu'une ligne de code ait changé —
// c'est ce qui est arrivé aux fixtures du 26/07/2026. Le 15 et le 17 existent
// dans tous les mois. `tests/playwright/membre-espace.spec.ts` applique la
// même convention pour que participation et événement public tombent le
// même jour (participationFor compare occurrence_date au jour de l'événement).
function jourDuMoisCourant(jour) {
  const maintenant = new Date()
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0')
  return `${maintenant.getFullYear()}-${mois}-${String(jour).padStart(2, '0')}`
}

export const DATE_EVENEMENT_MOCK = jourDuMoisCourant(15)
export const DATE_EVENEMENT_MOCK_2 = jourDuMoisCourant(17)

function defaultState() {
  return {
    members: {
      'ci-member@tests.fr': {
        id: 101,
        first_name: 'Claire',
        last_name: 'Membre',
        email: 'ci-member@tests.fr',
        role: 'member',
        teams: [{ id: 1, name: 'Louange', position: 'Chant' }],
        house_groups: [{ id: 1, name: 'Groupe Centre' }],
      },
      'ci-admin@tests.fr': {
        id: 100,
        first_name: 'Admin',
        last_name: 'CI',
        email: 'ci-admin@tests.fr',
        role: 'admin',
        teams: [],
        house_groups: [],
      },
    },
    resources: [
      {
        id: 1,
        title: 'Notes du sermon — Psaume 23',
        description: 'Étude du dimanche',
        url: 'https://example.com/ps23.pdf',
        created_at: '2026-07-15 10:00:00',
        expires_at: null,
        shared_by_first: 'Pasteur',
        shared_by_last: 'Test',
        // par email destinataire
        recipients: {
          'ci-member@tests.fr': { first_accessed_at: null, last_accessed_at: null, access_count: 0 },
        },
      },
    ],
    requests: [
      {
        id: 1,
        kind: 'admin_request',
        member_email: 'ci-member@tests.fr',
        message: 'Peux-tu chanter dimanche ?',
        position_label: 'Chant',
        event_id: 1,
        event_date: DATE_EVENEMENT_MOCK,
        status: 'pending',
        response_note: null,
        responded_at: null,
        created_at: '2026-07-18 09:00:00',
        created_by_first: 'Pasteur',
        created_by_last: 'Test',
      },
    ],
    // participations aux événements (agenda personnel)
    events: [
      {
        participation_id: 1,
        event_id: 1,
        member_email: 'ci-member@tests.fr',
        occurrence_date: DATE_EVENEMENT_MOCK,
        attendance_status: 'pending',
        responded_at: null,
        title: 'Culte du dimanche',
        start_date: DATE_EVENEMENT_MOCK,
        start_time: '10:00',
        location: 'Morlaix',
        repeat_period: 'week',
      },
    ],
    nextRequestId: 2,
  }
}

let state = defaultState()

// Jour situé `n` jours après aujourd'hui (date locale, pas toISOString).
function dansJours(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Événements de l'église pour les tests : en réel ils viennent du Worker
 * eglise-app, jamais appelé ici. Utilisés par /api/taches/sources, qui ne
 * garde que les événements À VENIR : ils sont donc datés à partir
 * d'aujourd'hui, pas sur le mois courant comme les autres fixtures — le 15
 * et le 17 du mois passaient dans le passé dès le 16, et
 * tests/playwright/taches-sources.spec.ts échouait la seconde moitié de
 * chaque mois sans qu'une ligne de code ait changé.
 */
export function getChurchEventsMock() {
  return [
    { id: 1, title: 'Culte du dimanche', start_date: dansJours(7), start_time: '10:00', location: 'Morlaix', status: 'active' },
    { id: 2, title: 'Soirée louange', start_date: dansJours(9), start_time: '19:30', location: 'Morlaix', status: 'active' },
  ]
}

/** Annuaire des membres, tel que le renverrait le Worker eglise-app. */
export function getMembersMock() {
  const data = Object.values(state.members).map((m) => ({
    id: m.id,
    first_name: m.first_name,
    last_name: m.last_name,
    email: m.email,
    role: m.role,
  }))
  return { data, page: 1, size: data.length, total: data.length }
}

export function resetMemberMock() {
  state = defaultState()
}

function findMember(email) {
  // Un email inconnu en test devient un membre simple (aligné sur l'auto-création du Worker)
  if (!state.members[email]) {
    state.members[email] = {
      id: 900 + Object.keys(state.members).length,
      first_name: email.split('@')[0],
      last_name: '',
      email,
      role: 'member',
      teams: [],
      house_groups: [],
    }
  }
  return state.members[email]
}

export function getMemberMeMock(email) {
  const m = findMember(email)
  const pending = state.requests.filter(
    (r) => r.member_email === email && r.kind === 'admin_request' && r.status === 'pending',
  ).length
  const unread = state.resources.filter(
    (r) => r.recipients[email] && !r.recipients[email].first_accessed_at,
  ).length
  return {
    member: { id: m.id, first_name: m.first_name, last_name: m.last_name, email: m.email, role: m.role },
    teams: m.teams,
    house_groups: m.house_groups,
    pending_requests: pending,
    unread_resources: unread,
  }
}

export function getMemberResourcesMock(email) {
  return {
    data: state.resources
      .filter((r) => r.recipients[email])
      .map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        url: r.url,
        created_at: r.created_at,
        expires_at: r.expires_at,
        shared_by_first: r.shared_by_first,
        shared_by_last: r.shared_by_last,
        ...r.recipients[email],
      })),
  }
}

export function accessResourceMock(email, id) {
  const r = state.resources.find((x) => x.id === Number(id))
  if (!r || !r.recipients[email]) return { error: 'Ressource non partagée avec vous', status: 403 }
  const rec = r.recipients[email]
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  if (!rec.first_accessed_at) rec.first_accessed_at = now
  rec.last_accessed_at = now
  rec.access_count += 1
  return { success: true, url: r.url }
}

export function getMemberRequestsMock(email) {
  return { data: state.requests.filter((r) => r.member_email === email) }
}

export function respondRequestMock(email, id, body) {
  const r = state.requests.find((x) => x.id === Number(id))
  if (!r) return { error: 'Demande introuvable', status: 404 }
  if (r.member_email !== email) return { error: 'Forbidden', status: 403 }
  if (r.kind !== 'admin_request' || r.status !== 'pending')
    return { error: 'Cette demande a déjà été traitée', status: 400 }
  r.status = body.status
  r.response_note = body.response_note || null
  r.responded_at = new Date().toISOString().slice(0, 19).replace('T', ' ')
  return r
}

export function createCandidacyMock(email, body) {
  const dup = state.requests.find(
    (r) => r.member_email === email && r.kind === 'candidacy' && r.position_key === body.position_key && r.status === 'pending',
  )
  if (dup) return { error: 'Vous avez déjà une candidature en attente pour ce poste', status: 400 }
  const created = {
    id: state.nextRequestId++,
    kind: 'candidacy',
    member_email: email,
    message: body.message || null,
    position_key: body.position_key,
    position_label: body.position_label,
    event_id: null,
    event_date: null,
    status: 'pending',
    response_note: null,
    responded_at: null,
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  }
  state.requests.push(created)
  return created
}

export function getMemberEventsMock(email) {
  return { data: state.events.filter((e) => e.member_email === email) }
}

export function setAttendanceMock(email, eventId, body) {
  const occurrence = body.occurrence_date || null
  let row = state.events.find(
    (e) => e.member_email === email && e.event_id === Number(eventId) && (e.occurrence_date || null) === occurrence,
  )
  if (!row) {
    row = {
      participation_id: 100 + state.events.length,
      event_id: Number(eventId),
      member_email: email,
      occurrence_date: occurrence,
      attendance_status: body.status,
      responded_at: null,
      title: '',
      start_date: occurrence,
      start_time: null,
      location: null,
      repeat_period: null,
    }
    state.events.push(row)
  }
  row.attendance_status = body.status
  row.responded_at = new Date().toISOString().slice(0, 19).replace('T', ' ')
  return { success: true, status: body.status }
}
