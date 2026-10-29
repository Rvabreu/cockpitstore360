export const CRM_STAGES = ['novo', 'contato', 'qualificado', 'cliente', 'perdido'] as const
export type CrmStage = typeof CRM_STAGES[number]
export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  novo: 'Novo', contato: 'Em contato', qualificado: 'Qualificado', cliente: 'Cliente', perdido: 'Perdido',
}
export interface CrmContact {
  id: string
  name: string
  email: string
  phone: string
  company: string
  stage: CrmStage
  createdAt: string
  updatedAt: string
}
export type CrmContactInput = Pick<CrmContact, 'name' | 'email' | 'phone' | 'company' | 'stage'>
export interface CrmNote { id: string; contactId: string; body: string; createdAt: string }
export interface CrmNoteInput { body: string }
export interface CrmContactsResponse {
  contacts: CrmContact[]
  total: number
  summary: { total: number; byStage: Record<CrmStage, number> }
}
export interface CrmContactResponse { contact: CrmContact }
export interface CrmNotesResponse { notes: CrmNote[]; total: number }
export interface CrmNoteResponse { note: CrmNote }
export interface CrmDeleteResponse { success: true }
export interface CrmErrorResponse { error: string }
