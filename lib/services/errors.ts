export type ServiceErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN_DELETE'
  | 'UNAUTHORIZED'
  | 'DATABASE';

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly status: number;

  constructor(code: ServiceErrorCode, message: string, status = 400) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.status = status;
  }
}

export function translateDbError(error: unknown, fallbackMessage: string): ServiceError {
  if (error instanceof ServiceError) {
    return error;
  }

  const errObj = error as { code?: string; cause?: { code?: string } } | null;
  const pgCode = errObj?.code ?? errObj?.cause?.code;

  if (pgCode === '42P01') {
    return new ServiceError(
      'DATABASE',
      'As tabelas do banco ainda não foram criadas. Execute as migrações iniciais (pnpm db:migrate ou o SQL em drizzle/) no Supabase.',
      503
    );
  }

  if (pgCode === '23503') {
    return new ServiceError(
      'FORBIDDEN_DELETE',
      'Esta operação viola um vínculo existente entre registros. Verifique despesas ou cadastros relacionados.',
      409
    );
  }

  if (pgCode === '23505') {
    return new ServiceError(
      'CONFLICT',
      'Já existe um registro com esses mesmos dados.',
      409
    );
  }

  if (pgCode === '22P02') {
    return new ServiceError('VALIDATION', 'Identificador ou formato de dado inválido.', 400);
  }

  return new ServiceError('DATABASE', fallbackMessage, 500);
}
