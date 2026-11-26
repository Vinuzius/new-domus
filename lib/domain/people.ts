export interface DefaultSelectablePerson {
  id: string;
  isDefault?: boolean;
}

/**
 * Seleciona o responsável padrão configurado; se nenhum estiver marcado,
 * faz fallback para a primeira pessoa da lista.
 */
export function resolveDefaultPersonId(
  people: readonly DefaultSelectablePerson[]
): string {
  const defaultPerson = people.find((person) => Boolean(person.isDefault));
  return defaultPerson?.id ?? people[0]?.id ?? '';
}
